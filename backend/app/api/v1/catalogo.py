"""
Catálogo producto → variante → unidad.

Convive con `/assets` mientras dura la migración por tramos: este router opera
sobre el catálogo nuevo y aquél sigue sirviendo préstamos, escaneo e inventario.
"""
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.core.dependencies import CurrentToken, DBSession
from app.models.codigo import Codigo
from app.models.inventory_log import InventoryLog
from app.models.unidad import Unidad
from app.models.user import User
from app.models.variante import Variante
from app.repositories.codigo import CodigoRepository
from app.repositories.producto import ProductoRepository
from app.repositories.proveedor import ProveedorRepository
from app.repositories.unidad import UnidadRepository
from app.repositories.variante import VarianteRepository
from app.schemas.asset_family import AssetFamilyResponse
from app.schemas.catalogo import (
    CodigoCreate,
    CodigoResponse,
    DespachoPendienteResponse,
    MovimientoResponse,
    ProductoCreate,
    ProductoResponse,
    ProductoUpdate,
    UnidadAccion,
    UnidadCreate,
    UnidadResponse,
    UnidadUpdate,
    VarianteAdjust,
    VarianteCreate,
    VarianteDetalle,
    VarianteLoss,
    VariantePurchase,
    VarianteReintegro,
    VarianteResponse,
    VarianteShrinkage,
    VarianteUpdate,
    VarianteWithdraw,
)
from app.services import catalogo as svc
from app.services import prestamo as prestamo_svc

router = APIRouter(tags=["Catálogo"])


# ── Serializadores ───────────────────────────────────────────────────────────


def _codigo_resp(c: Codigo) -> CodigoResponse:
    return CodigoResponse(
        id=c.id,
        codigo=c.codigo,
        tipo=c.tipo,
        proveedor_id=c.proveedor_id,
        proveedor_nombre=c.proveedor.nombre if c.proveedor else None,
        factor=c.factor,
        nombre_empaque=c.nombre_empaque,
        es_principal=c.es_principal,
        variante_id=c.variante_id,
        unidad_id=c.unidad_id,
    )


def _unidad_resp(u: Unidad) -> UnidadResponse:
    codigos = sorted(u.codigos, key=lambda c: (not c.es_principal, c.id))
    principal = next((c.codigo for c in codigos if c.es_principal), None)
    return UnidadResponse(
        id=u.id,
        tenant_id=u.tenant_id,
        variante_id=u.variante_id,
        estado_id=u.estado_id,
        ubicacion_id=u.ubicacion_id,
        ubicacion=u.ubicacion,
        parent_unidad_id=u.parent_unidad_id,
        proxima_mantencion=u.proxima_mantencion,
        created_at=u.created_at,
        codigos=[_codigo_resp(c) for c in codigos],
        codigo_principal=principal,
    )


def _variante_resp(v: Variante, total: int, disponibles: int) -> VarianteResponse:
    familia = v.producto.family
    comportamiento = familia.comportamiento
    efectivo = VarianteRepository.stock_efectivo(v, comportamiento, disponibles)
    return VarianteResponse(
        id=v.id,
        tenant_id=v.tenant_id,
        producto_id=v.producto_id,
        producto_nombre=v.producto.nombre,
        nombre=v.nombre,
        atributos=v.atributos or {},
        unidad=v.unidad,
        comportamiento=comportamiento,
        family=AssetFamilyResponse.model_validate(familia),
        stock_actual=v.stock_actual,
        stock_minimo=v.stock_minimo,
        stock_efectivo=efectivo,
        # stock_minimo en 0 desactiva la alerta: si no, todo el catálogo sin
        # mínimo configurado aparecería como quiebre permanente.
        bajo_stock=bool(v.stock_minimo and v.stock_minimo > 0 and efectivo <= v.stock_minimo),
        unidades_total=total,
        unidades_disponibles=disponibles,
        precio_compra=v.precio_compra,
        valor_reposicion=v.valor_reposicion,
        dias_max_prestamo=v.dias_max_prestamo,
        ubicacion_id=v.ubicacion_id,
        ubicacion=v.ubicacion,
        created_at=v.created_at,
        codigos=[_codigo_resp(c) for c in sorted(v.codigos, key=lambda c: (not c.es_principal, c.id))],
    )


async def _producto_resp(producto, session, tenant_id) -> ProductoResponse:
    repo = VarianteRepository(session, tenant_id)
    filas = await repo.listar(producto_id=producto.id, limit=500)
    return ProductoResponse(
        id=producto.id,
        tenant_id=producto.tenant_id,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        family_id=producto.family_id,
        family=AssetFamilyResponse.model_validate(producto.family),
        comportamiento=producto.family.comportamiento,
        brand_id=producto.brand_id,
        brand_nombre=producto.brand.nombre if producto.brand else None,
        created_at=producto.created_at,
        variantes=[_variante_resp(v, t, d) for v, t, d in filas],
    )


async def _movimiento_resp(m: InventoryLog, session, tenant_id) -> MovimientoResponse:
    nombre = None
    if m.proveedor_id:
        proveedor = await ProveedorRepository(session, tenant_id).get(m.proveedor_id)
        nombre = proveedor.nombre if proveedor else None
    operario_nombre = None
    if m.operario_id:
        operario = await session.get(User, m.operario_id)
        operario_nombre = operario.nombre if operario else None
    return MovimientoResponse(
        id=m.id,
        variante_id=m.variante_id,
        unidad_id=m.unidad_id,
        codigo_id=m.codigo_id,
        proveedor_id=m.proveedor_id,
        proveedor_nombre=nombre,
        tipo_movimiento=m.tipo_movimiento,
        cantidad=m.cantidad,
        costo_unitario=m.costo_unitario,
        operario_id=m.operario_id,
        operario_nombre=operario_nombre,
        project_id=m.project_id,
        fecha_hora=m.fecha_hora,
        observaciones=m.observaciones,
    )


async def _get_variante_o_404(variante_id: int, session, tenant_id) -> tuple[Variante, int, int]:
    fila = await VarianteRepository(session, tenant_id).get_con_conteos(variante_id)
    if not fila:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variante no encontrada")
    return fila


# ── Productos ────────────────────────────────────────────────────────────────


@router.get("/productos", response_model=list[ProductoResponse])
async def list_productos(
    token: CurrentToken,
    session: DBSession,
    comportamiento: str | None = Query(None, pattern="^(prestable|consumible)$"),
    brand_id: int | None = None,
    buscar: str | None = None,
    offset: int = 0,
    limit: int = Query(50, le=200),
):
    repo = ProductoRepository(session, token.tenant_id)
    productos = await repo.listar(comportamiento, brand_id, buscar, offset, limit)
    return [await _producto_resp(p, session, token.tenant_id) for p in productos]


@router.post("/productos", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
async def create_producto(data: ProductoCreate, token: CurrentToken, session: DBSession):
    """Alta en un solo paso. Sin variantes declaradas se crea una homónima."""
    producto = await svc.crear_producto(data, session, token.tenant_id)
    await session.commit()
    producto = await ProductoRepository(session, token.tenant_id).get_con_relaciones(producto.id)
    return await _producto_resp(producto, session, token.tenant_id)


@router.get("/productos/{producto_id}", response_model=ProductoResponse)
async def get_producto(producto_id: int, token: CurrentToken, session: DBSession):
    producto = await ProductoRepository(session, token.tenant_id).get_con_relaciones(producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return await _producto_resp(producto, session, token.tenant_id)


@router.patch("/productos/{producto_id}", response_model=ProductoResponse)
async def update_producto(
    producto_id: int, data: ProductoUpdate, token: CurrentToken, session: DBSession
):
    """Corrige nombre, descripción, marca o familia.

    El nombre puede cambiar libremente: los movimientos referencian identificadores,
    así que la bitácora histórica no se ve afectada.
    """
    repo = ProductoRepository(session, token.tenant_id)
    producto = await repo.get_con_relaciones(producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    cambios = data.model_dump(exclude_unset=True)

    if cambios.get("nombre") and cambios["nombre"].strip().lower() != producto.nombre.lower():
        if await repo.get_por_nombre(cambios["nombre"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un producto '{cambios['nombre']}'",
            )
        cambios["nombre"] = cambios["nombre"].strip()

    if cambios.get("family_id"):
        await svc.validar_cambio_de_familia(
            producto, cambios["family_id"], session, token.tenant_id
        )

    await repo.update(producto, **cambios)
    await session.commit()
    producto = await repo.get_con_relaciones(producto_id)
    return await _producto_resp(producto, session, token.tenant_id)


@router.delete("/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_producto(producto_id: int, token: CurrentToken, session: DBSession):
    repo = ProductoRepository(session, token.tenant_id)
    producto = await repo.get_con_relaciones(producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    await svc.validar_borrado_de_producto(producto, session, token.tenant_id)
    await repo.delete(producto)
    await session.commit()


@router.post(
    "/productos/{producto_id}/variantes",
    response_model=VarianteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_variante(
    producto_id: int, data: VarianteCreate, token: CurrentToken, session: DBSession
):
    producto = await ProductoRepository(session, token.tenant_id).get_con_relaciones(producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    variante = await svc.crear_variante(producto, data, session, token.tenant_id)
    await session.commit()
    v, t, d = await _get_variante_o_404(variante.id, session, token.tenant_id)
    return _variante_resp(v, t, d)


# ── Variantes ────────────────────────────────────────────────────────────────
# Las rutas literales van antes que /{variante_id} para que no las capture.


@router.get("/variantes/low-stock", response_model=list[VarianteResponse])
async def list_low_stock(token: CurrentToken, session: DBSession):
    """Quiebres unificados: consumibles por columna, herramientas por conteo."""
    filas = await VarianteRepository(session, token.tenant_id).bajo_stock()
    respuestas = [_variante_resp(v, t, d) for v, t, d in filas]
    return sorted(respuestas, key=lambda r: r.stock_efectivo)


@router.get("/variantes", response_model=list[VarianteResponse])
async def list_variantes(
    token: CurrentToken,
    session: DBSession,
    comportamiento: str | None = Query(None, pattern="^(prestable|consumible)$"),
    producto_id: int | None = None,
    buscar: str | None = None,
    atributo: str | None = Query(None, description="clave:valor, ej. material:zincado"),
    offset: int = 0,
    limit: int = Query(50, le=200),
):
    par = None
    if atributo:
        if ":" not in atributo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="atributo debe tener formato clave:valor",
            )
        clave, _, valor = atributo.partition(":")
        par = (clave.strip(), valor.strip())

    filas = await VarianteRepository(session, token.tenant_id).listar(
        comportamiento, producto_id, buscar, par, offset, limit
    )
    return [_variante_resp(v, t, d) for v, t, d in filas]


@router.get("/variantes/{variante_id}", response_model=VarianteDetalle)
async def get_variante(variante_id: int, token: CurrentToken, session: DBSession):
    v, total, disponibles = await _get_variante_o_404(variante_id, session, token.tenant_id)
    base = _variante_resp(v, total, disponibles)
    unidades = await UnidadRepository(session, token.tenant_id).list_de_variante(variante_id)
    return VarianteDetalle(**base.model_dump(), unidades=[_unidad_resp(u) for u in unidades])


@router.patch("/variantes/{variante_id}", response_model=VarianteResponse)
async def update_variante(
    variante_id: int, data: VarianteUpdate, token: CurrentToken, session: DBSession
):
    """Corrige los datos de la variante.

    No expone `stock_actual`: las existencias se mueven por compra, ajuste o merma,
    para que ningún cambio de stock quede sin explicación en la bitácora.
    """
    repo = VarianteRepository(session, token.tenant_id)
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    cambios = data.model_dump(exclude_unset=True)

    if cambios.get("nombre") and cambios["nombre"].strip().lower() != v.nombre.lower():
        if await repo.get_por_nombre(v.producto_id, cambios["nombre"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"El producto ya tiene una variante '{cambios['nombre']}'",
            )
        cambios["nombre"] = cambios["nombre"].strip()

    if cambios.get("unidad"):
        await svc.validar_cambio_de_unidad(v, cambios["unidad"])

    await repo.update(v, **cambios)
    await session.commit()
    v, t, d = await _get_variante_o_404(variante_id, session, token.tenant_id)
    return _variante_resp(v, t, d)


@router.delete("/variantes/{variante_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variante(variante_id: int, token: CurrentToken, session: DBSession):
    repo = VarianteRepository(session, token.tenant_id)
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    await svc.validar_borrado_de_variante(
        v, session, token.tenant_id, v.producto.family.comportamiento
    )
    await repo.delete(v)
    await session.commit()


@router.post(
    "/variantes/{variante_id}/purchase",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def purchase_variante(
    variante_id: int, data: VariantePurchase, token: CurrentToken, session: DBSession
):
    """Registra una compra: suma al stock y deja el movimiento en la bitácora.

    Con `empaques` + `codigo_id`, el contenido lo aporta el código escaneado — la
    caja de un proveedor trae 100 y la del otro 250 — y el proveedor se deduce de
    ahí sin pedírselo al bodeguero.
    """
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.comprar(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/variantes/{variante_id}/withdraw",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def withdraw_variante(
    variante_id: int, data: VarianteWithdraw, token: CurrentToken, session: DBSession
):
    """Entrega consumible a un operario: descuenta stock y deja el movimiento.

    No genera préstamo — un tornillo no se devuelve. Cualquiera de los códigos de
    la variante lleva acá: el que identifica al proveedor, el del empaque o el
    interno. Todos apuntan al mismo pozo.
    """
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.retirar(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/variantes/{variante_id}/adjust",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def adjust_variante(
    variante_id: int, data: VarianteAdjust, token: CurrentToken, session: DBSession
):
    """Fija el stock al valor contado. Única vía para corregir existencias."""
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.ajustar_stock(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/variantes/{variante_id}/shrinkage",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def shrinkage_variante(
    variante_id: int, data: VarianteShrinkage, token: CurrentToken, session: DBSession
):
    """Merma: descuenta por daño, vencimiento o corrección de conteo a la baja."""
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.registrar_merma(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/variantes/{variante_id}/loss",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def loss_variante(
    variante_id: int, data: VarianteLoss, token: CurrentToken, session: DBSession
):
    """Pérdida o robo de consumible: descuenta la cantidad reportada.

    Se separa de la merma a propósito: si el robo se diluye dentro del consumo o
    de la merma, nadie lo ve.
    """
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.registrar_perdida(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.get(
    "/variantes/{variante_id}/despachos-pendientes",
    response_model=list[DespachoPendienteResponse],
)
async def despachos_pendientes(variante_id: int, token: CurrentToken, session: DBSession):
    """Entregas que todavía admiten reintegro: sin devolución previa y de proyecto
    activo. Más recientes primero."""
    from app.repositories.inventory_log import InventoryLogRepository

    await _get_variante_o_404(variante_id, session, token.tenant_id)
    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.despachos_abiertos_variante(variante_id)


@router.post(
    "/variantes/{variante_id}/reintegro",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reintegro_variante(
    variante_id: int, data: VarianteReintegro, token: CurrentToken, session: DBSession
):
    """Devuelve al stock el sobrante de un despacho.

    No es compra ni pérdida: lo que no vuelve queda como consumo real del proyecto.
    """
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    log = await svc.reintegrar(
        v, data, session, token.tenant_id, token.user_id,
        comportamiento=v.producto.family.comportamiento,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.get("/variantes/{variante_id}/movimientos", response_model=list[MovimientoResponse])
async def list_movimientos(variante_id: int, token: CurrentToken, session: DBSession):
    """Bitácora de la variante, más recientes primero."""
    await _get_variante_o_404(variante_id, session, token.tenant_id)
    result = await session.execute(
        select(InventoryLog)
        .where(InventoryLog.tenant_id == token.tenant_id)
        .where(InventoryLog.variante_id == variante_id)
        .order_by(InventoryLog.id.desc())
        .limit(200)
    )
    logs = list(result.scalars().all())
    return [await _movimiento_resp(m, session, token.tenant_id) for m in logs]


@router.get("/variantes/{variante_id}/atributos", response_model=list[str])
async def claves_de_atributo(variante_id: int, token: CurrentToken, session: DBSession):
    """Claves ya usadas en el producto, para ofrecerlas como autocompletado."""
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    return await VarianteRepository(session, token.tenant_id).claves_de_atributo(v.producto_id)


# ── Unidades ─────────────────────────────────────────────────────────────────


@router.get("/variantes/{variante_id}/unidades", response_model=list[UnidadResponse])
async def list_unidades(variante_id: int, token: CurrentToken, session: DBSession):
    await _get_variante_o_404(variante_id, session, token.tenant_id)
    unidades = await UnidadRepository(session, token.tenant_id).list_de_variante(variante_id)
    return [_unidad_resp(u) for u in unidades]


@router.post(
    "/variantes/{variante_id}/unidades",
    response_model=list[UnidadResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_unidades(
    variante_id: int, data: UnidadCreate, token: CurrentToken, session: DBSession
):
    """Alta por cantidad, con código principal autogenerado listo para imprimir."""
    v, _, _ = await _get_variante_o_404(variante_id, session, token.tenant_id)
    await svc.crear_unidades(
        v,
        data.cantidad,
        session,
        token.tenant_id,
        comportamiento=v.producto.family.comportamiento,
        ubicacion_id=data.ubicacion_id,
        estado_id=data.estado_id,
        proxima_mantencion=data.proxima_mantencion,
    )
    await session.commit()
    unidades = await UnidadRepository(session, token.tenant_id).list_de_variante(variante_id)
    return [_unidad_resp(u) for u in unidades]


@router.post(
    "/unidades/{unidad_id}/repair-done",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def repair_done_unidad(
    unidad_id: int, data: UnidadAccion, token: CurrentToken, session: DBSession
):
    """Cierra la reparación: el ejemplar vuelve a Disponible."""
    log = await prestamo_svc.cerrar_reparacion(
        unidad_id, session, token.tenant_id, token.user_id, observaciones=data.observaciones
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/unidades/{unidad_id}/loss",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def loss_unidad(
    unidad_id: int, data: UnidadAccion, token: CurrentToken, session: DBSession
):
    """Reporta el ejemplar como robado y cierra su préstamo si lo tenía.

    Dejarlo abierto lo mostraría para siempre como "en terreno", que es distinto
    de "no está".
    """
    log = await prestamo_svc.reportar_perdida_unidad(
        unidad_id, session, token.tenant_id, token.user_id,
        project_id=data.project_id, observaciones=data.observaciones,
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.post(
    "/unidades/{unidad_id}/reingreso",
    response_model=MovimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reingreso_unidad(
    unidad_id: int, data: UnidadAccion, token: CurrentToken, session: DBSession
):
    """La herramienta dada por perdida apareció: vuelve a Disponible.

    La pérdida no se borra —pasó, y borrarla dejaría un robo sin rastro—: se
    registra un movimiento que la neutraliza y le devuelve el costo a la obra.
    """
    log = await prestamo_svc.reingresar_unidad(
        unidad_id, session, token.tenant_id, token.user_id, observaciones=data.observaciones
    )
    await session.commit()
    return await _movimiento_resp(log, session, token.tenant_id)


@router.get("/unidades/{unidad_id}", response_model=UnidadResponse)
async def get_unidad(unidad_id: int, token: CurrentToken, session: DBSession):
    unidad = await UnidadRepository(session, token.tenant_id).get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    return _unidad_resp(unidad)


@router.patch("/unidades/{unidad_id}", response_model=UnidadResponse)
async def update_unidad(
    unidad_id: int, data: UnidadUpdate, token: CurrentToken, session: DBSession
):
    """Corrige la ubicación o la próxima mantención del ejemplar.

    No expone el estado: ése lo mueven el préstamo, la devolución, la reparación y
    la pérdida, de modo que todo cambio quede explicado por el hecho que lo causó.
    """
    repo = UnidadRepository(session, token.tenant_id)
    unidad = await repo.get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    await repo.update(unidad, **data.model_dump(exclude_unset=True))
    await session.commit()
    return _unidad_resp(await repo.get_con_relaciones(unidad_id))


@router.delete("/unidades/{unidad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unidad(unidad_id: int, token: CurrentToken, session: DBSession):
    repo = UnidadRepository(session, token.tenant_id)
    unidad = await repo.get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    await svc.validar_borrado_de_unidad(unidad, session, token.tenant_id)
    await repo.delete(unidad)
    await session.commit()


# ── Códigos ──────────────────────────────────────────────────────────────────


@router.post(
    "/variantes/{variante_id}/codigos",
    response_model=CodigoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_codigo_variante(
    variante_id: int, data: CodigoCreate, token: CurrentToken, session: DBSession
):
    await _get_variante_o_404(variante_id, session, token.tenant_id)
    codigo = await svc.agregar_codigo(data, session, token.tenant_id, variante_id=variante_id)
    await session.commit()
    return _codigo_resp(codigo)


@router.post(
    "/unidades/{unidad_id}/codigos",
    response_model=CodigoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_codigo_unidad(
    unidad_id: int, data: CodigoCreate, token: CurrentToken, session: DBSession
):
    repo = UnidadRepository(session, token.tenant_id)
    if not await repo.get(unidad_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    codigo = await svc.agregar_codigo(data, session, token.tenant_id, unidad_id=unidad_id)
    await session.commit()
    return _codigo_resp(codigo)


@router.patch("/codigos/{codigo_id}/principal", response_model=CodigoResponse)
async def set_principal(codigo_id: int, token: CurrentToken, session: DBSession):
    repo = CodigoRepository(session, token.tenant_id)
    codigo = await repo.get(codigo_id)
    if not codigo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Código no encontrado")
    codigo = await svc.marcar_principal(codigo, session, token.tenant_id)
    await session.commit()
    return _codigo_resp(codigo)


@router.delete("/codigos/{codigo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_codigo(codigo_id: int, token: CurrentToken, session: DBSession):
    repo = CodigoRepository(session, token.tenant_id)
    codigo = await repo.get(codigo_id)
    if not codigo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Código no encontrado")
    await svc.eliminar_codigo(codigo, session, token.tenant_id)
    await session.commit()


@router.get("/scan-catalogo/{codigo}")
async def scan_catalogo(codigo: str, token: CurrentToken, session: DBSession):
    """Resolución por cualquier código: una sola consulta, sin precedencia inventada.

    Devuelve qué resolvió — una variante o una unidad — para que la interfaz elija
    la acción. Es el endpoint que reemplazará a `/assets/scan/{uid}` cuando el
    catálogo viejo salga de circulación.
    """
    resuelto = await CodigoRepository(session, token.tenant_id).get_by_codigo(codigo)
    if not resuelto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Código no encontrado")

    if resuelto.unidad_id:
        unidad = await UnidadRepository(session, token.tenant_id).get_con_relaciones(
            resuelto.unidad_id
        )
        v, t, d = await _get_variante_o_404(unidad.variante_id, session, token.tenant_id)
        return {
            "resolvio": "unidad",
            "codigo": _codigo_resp(resuelto),
            "unidad": _unidad_resp(unidad),
            "variante": _variante_resp(v, t, d),
        }

    v, t, d = await _get_variante_o_404(resuelto.variante_id, session, token.tenant_id)
    return {
        "resolvio": "variante",
        "codigo": _codigo_resp(resuelto),
        "variante": _variante_resp(v, t, d),
        # El factor viaja para que la compra por empaque llegue precargada.
        "factor": float(resuelto.factor) if resuelto.tipo == "empaque" else float(Decimal(1)),
    }
