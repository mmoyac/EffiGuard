"""
Reglas de negocio del catálogo producto → variante → unidad.

Concentra lo que no puede vivir en un repositorio: la variante implícita del alta,
la validación de que un código cuelgue del nivel correcto, y el mantenimiento del
código principal.
"""
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.uid import generar_uid
from app.models.codigo import TIPOS_DE_UNIDAD, TIPOS_DE_VARIANTE, Codigo
from app.models.producto import Producto
from app.models.unidad import Unidad
from app.models.variante import Variante
from app.repositories.codigo import CodigoRepository
from app.repositories.producto import ProductoRepository
from app.repositories.unidad import UnidadRepository
from app.repositories.variante import VarianteRepository
from app.schemas.catalogo import (
    CodigoCreate,
    ProductoCreate,
    VarianteCreate,
    VarianteAdjust,
    VariantePurchase,
    VarianteReintegro,
    VarianteWithdraw,
)

ESTADO_DISPONIBLE = 1
# El material en terreno lo retira un operario, no un admin ni el bodeguero.
ROL_OPERARIO = 4


# ── Validaciones ─────────────────────────────────────────────────────────────


def validar_nivel_del_codigo(tipo: str, *, es_variante: bool) -> None:
    """El tipo decide de qué nivel cuelga el código.

    Un EAN13 identifica el modelo, no el ejemplar: los tres esmeriles de la bodega
    traen el mismo número impreso. Si colgara de la unidad habría que repetirlo y
    `UNIQUE (tenant_id, codigo)` lo rechazaría al segundo — correctamente, porque
    el dato estaría mal puesto. Validarlo acá evita un error que si no aparece
    recién cuando llega el segundo ejemplar, con datos ya cargados que corregir.
    """
    if es_variante and tipo in TIPOS_DE_UNIDAD:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Un número de serie identifica un ejemplar: debe colgar de la unidad",
        )
    if not es_variante and tipo in TIPOS_DE_VARIANTE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Un código de fabricante identifica el modelo, no el ejemplar: "
                "debe colgar de la variante"
            ),
        )


async def _comportamiento_de(producto: Producto) -> str:
    return producto.family.comportamiento


# ── Códigos ──────────────────────────────────────────────────────────────────


async def agregar_codigo(
    data: CodigoCreate,
    session: AsyncSession,
    tenant_id: int,
    *,
    variante_id: int | None = None,
    unidad_id: int | None = None,
) -> Codigo:
    if (variante_id is None) == (unidad_id is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Un código pertenece a una variante o a una unidad, no a ambas",
        )

    validar_nivel_del_codigo(data.tipo, es_variante=variante_id is not None)

    repo = CodigoRepository(session, tenant_id)
    existente = await repo.get_by_codigo(data.codigo)
    if existente:
        # Mismo dueño → idempotente. Es lo que permite repetir el EAN del modelo en
        # las tres filas de un mismo taladro en el Excel sin que sea un error.
        mismo_dueno = (
            existente.variante_id == variante_id and existente.unidad_id == unidad_id
        )
        if mismo_dueno:
            return existente
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El código '{data.codigo}' ya está registrado en otro item",
        )

    # El primer código de un item queda principal automáticamente: así ningún item
    # se queda sin código para mostrar en listados ni imprimir en la etiqueta.
    hermanos = (
        await repo.list_de_variante(variante_id)
        if variante_id
        else await repo.list_de_unidad(unidad_id)
    )

    return await repo.create(
        variante_id=variante_id,
        unidad_id=unidad_id,
        codigo=data.codigo,
        tipo=data.tipo,
        proveedor_id=data.proveedor_id,
        factor=data.factor,
        nombre_empaque=data.nombre_empaque,
        es_principal=not hermanos,
    )


async def eliminar_codigo(codigo: Codigo, session: AsyncSession, tenant_id: int) -> None:
    """Al borrar el principal, promueve al más antiguo de los restantes.

    La promoción se resuelve acá y no con una restricción de "al menos uno" en SQL
    porque ésa exigiría diferir constraints en cada alta.
    """
    repo = CodigoRepository(session, tenant_id)
    era_principal = codigo.es_principal
    variante_id, unidad_id = codigo.variante_id, codigo.unidad_id

    hermanos = (
        await repo.list_de_variante(variante_id)
        if variante_id
        else await repo.list_de_unidad(unidad_id)
    )
    restantes = [c for c in hermanos if c.id != codigo.id]

    if unidad_id and not restantes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Una unidad debe conservar al menos un código",
        )

    await repo.delete(codigo)

    if era_principal and restantes:
        mas_antiguo = min(restantes, key=lambda c: c.id)
        await repo.update(mas_antiguo, es_principal=True)


async def marcar_principal(codigo: Codigo, session: AsyncSession, tenant_id: int) -> Codigo:
    """El anterior deja de serlo en la misma operación: el índice parcial único
    rechazaría dos principales del mismo dueño."""
    repo = CodigoRepository(session, tenant_id)
    hermanos = (
        await repo.list_de_variante(codigo.variante_id)
        if codigo.variante_id
        else await repo.list_de_unidad(codigo.unidad_id)
    )
    for hermano in hermanos:
        if hermano.es_principal and hermano.id != codigo.id:
            await repo.update(hermano, es_principal=False)
    await session.flush()
    return await repo.update(codigo, es_principal=True)


# ── Unidades ─────────────────────────────────────────────────────────────────


async def crear_unidades(
    variante: Variante,
    cantidad: int,
    session: AsyncSession,
    tenant_id: int,
    *,
    comportamiento: str,
    ubicacion_id: int | None = None,
    estado_id: int = ESTADO_DISPONIBLE,
    proxima_mantencion=None,
) -> list[Unidad]:
    """Alta por cantidad: recibir 10 taladros iguales es una operación, no diez.

    Cada unidad nace con su código principal autogenerado en formato EFG-XXXXXXXX,
    listo para imprimir. El código de fábrica, si existe, se agrega después como
    `serie_fabrica` — que es justo lo que permite tener varios códigos por unidad.
    """
    if comportamiento != "prestable":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sólo las familias prestables tienen unidades",
        )
    if cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
        )

    unidad_repo = UnidadRepository(session, tenant_id)
    codigo_repo = CodigoRepository(session, tenant_id)
    usados = await unidad_repo.codigos_usados()

    creadas: list[Unidad] = []
    for _ in range(cantidad):
        unidad = await unidad_repo.create(
            variante_id=variante.id,
            estado_id=estado_id,
            ubicacion_id=ubicacion_id,
            proxima_mantencion=proxima_mantencion,
        )
        uid = generar_uid(usados)
        usados.add(uid)
        await codigo_repo.create(
            unidad_id=unidad.id,
            codigo=uid,
            tipo="propio",
            factor=Decimal(1),
            es_principal=True,
        )
        creadas.append(unidad)

    return creadas


# ── Alta de catálogo ─────────────────────────────────────────────────────────


async def crear_variante(
    producto: Producto,
    data: VarianteCreate,
    session: AsyncSession,
    tenant_id: int,
) -> Variante:
    comportamiento = await _comportamiento_de(producto)
    repo = VarianteRepository(session, tenant_id)

    if await repo.get_por_nombre(producto.id, data.nombre):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El producto ya tiene una variante '{data.nombre}'",
        )

    # El stock de una prestable es derivado: aceptar un número acá crearía una
    # segunda fuente de verdad que contradice al conteo de unidades.
    stock_inicial = Decimal(0) if comportamiento == "prestable" else data.stock_actual

    variante = await repo.create(
        producto_id=producto.id,
        nombre=data.nombre.strip(),
        atributos=data.atributos or {},
        unidad=data.unidad,
        stock_actual=stock_inicial,
        stock_minimo=data.stock_minimo,
        precio_compra=data.precio_compra,
        valor_reposicion=data.valor_reposicion,
        dias_max_prestamo=data.dias_max_prestamo,
        ubicacion_id=data.ubicacion_id,
    )

    for codigo_data in data.codigos:
        # El tipo rutea el código a su nivel sin necesidad de un campo aparte.
        if codigo_data.tipo in TIPOS_DE_UNIDAD:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"El código '{codigo_data.codigo}' es de tipo {codigo_data.tipo}: "
                    "debe declararse en una unidad, no en la variante"
                ),
            )
        await agregar_codigo(codigo_data, session, tenant_id, variante_id=variante.id)

    if data.cantidad_unidades:
        await crear_unidades(
            variante,
            data.cantidad_unidades,
            session,
            tenant_id,
            comportamiento=comportamiento,
            ubicacion_id=data.ubicacion_id,
        )

    return variante


async def crear_producto(
    data: ProductoCreate, session: AsyncSession, tenant_id: int
) -> Producto:
    """Alta en un solo formulario, con variante implícita si no se declaran."""
    repo = ProductoRepository(session, tenant_id)

    if await repo.get_por_nombre(data.nombre):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un producto '{data.nombre}'",
        )

    producto = await repo.create(
        nombre=data.nombre.strip(),
        family_id=data.family_id,
        brand_id=data.brand_id,
        descripcion=data.descripcion,
    )
    producto = await repo.get_con_relaciones(producto.id)
    if producto is None:  # pragma: no cover — recién creado
        raise HTTPException(status_code=500, detail="No se pudo crear el producto")

    variantes = data.variantes or [
        VarianteCreate(
            nombre=data.nombre.strip(),
            unidad=data.unidad,
            stock_actual=data.stock_actual,
            stock_minimo=data.stock_minimo,
            precio_compra=data.precio_compra,
            valor_reposicion=data.valor_reposicion,
            dias_max_prestamo=data.dias_max_prestamo,
            ubicacion_id=data.ubicacion_id,
            codigos=data.codigos,
            cantidad_unidades=data.cantidad_unidades,
        )
    ]

    for variante_data in variantes:
        await crear_variante(producto, variante_data, session, tenant_id)

    return producto


# ── Edición ──────────────────────────────────────────────────────────────────


async def validar_cambio_de_familia(
    producto: Producto, nueva_family_id: int, session: AsyncSession, tenant_id: int
) -> None:
    """Un cambio de familia reinterpreta el inventario que ya existe.

    Prestable y consumible no son etiquetas: definen dónde vive el stock. Pasar a
    consumible con ejemplares cargados dejaría unidades colgando de un
    comportamiento que no las contempla; pasar a prestable con stock dejaría un
    número que nadie volvería a mirar, porque el stock de un prestable se deriva
    del conteo de sus ejemplares.
    """
    from app.models.asset_family import AssetFamily

    if nueva_family_id == producto.family_id:
        return

    familia = await session.get(AssetFamily, nueva_family_id)
    if not familia or familia.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Familia no encontrada"
        )

    repo = VarianteRepository(session, tenant_id)
    filas = await repo.listar(producto_id=producto.id, limit=500)

    if familia.comportamiento == "consumible":
        # Bucle explícito: `await` dentro de un generador lo convierte en async
        # generator, que `sum()` no puede consumir.
        unidades = 0
        for v, _, _ in filas:
            unidades += await repo.contar_unidades(v.id)
        if unidades:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"No se puede cambiar a consumible: el producto tiene {unidades} "
                    "unidad(es). Elimínelas primero"
                ),
            )
    else:
        con_stock = [v for v, _, _ in filas if v.stock_actual != 0]
        if con_stock:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No se puede cambiar a prestable: hay variantes con stock, y el "
                    "stock de una herramienta se deriva de sus ejemplares. Ajuste el "
                    "stock a 0 primero"
                ),
            )


async def validar_cambio_de_unidad(variante: Variante, nueva_unidad: str) -> None:
    """Cambiar metros por unidades con existencias no es renombrar una etiqueta:
    es afirmar algo distinto sobre lo que hay en la repisa."""
    if nueva_unidad == variante.unidad or variante.stock_actual == 0:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f"No se puede cambiar la unidad con {variante.stock_actual} en stock: "
            f"convertirlas de '{variante.unidad}' a '{nueva_unidad}' cambiaría lo que "
            "dice el inventario. Ajuste el stock a 0 primero"
        ),
    )


# ── Compra ───────────────────────────────────────────────────────────────────


async def comprar(
    variante: Variante,
    data: VariantePurchase,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    comportamiento: str,
):
    """Ingresa una compra: suma al stock y registra un log tipo `compra`.

    El movimiento SIEMPRE se registra en la unidad de stock —300 tornillos, no 3
    cajas—, que es lo que mantiene la bitácora homogénea y el consumo por proyecto
    comparable entre movimientos que entraron por caminos distintos.
    """
    from app.repositories.inventory_log import InventoryLogRepository

    if comportamiento != "consumible":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Solo aplica a consumibles"
        )
    if (data.cantidad is None) == (data.empaques is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Envíe cantidad o empaques, no ambos",
        )

    codigo_repo = CodigoRepository(session, tenant_id)
    codigo = None
    if data.codigo_id is not None:
        codigo = await codigo_repo.get(data.codigo_id)
        if codigo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Código no encontrado"
            )
        if codigo.variante_id != variante.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código no pertenece a esta variante",
            )

    observaciones = data.observaciones

    if data.empaques is not None:
        if data.empaques <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
            )
        if codigo is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comprar por empaque requiere el código del empaque: ahí está el contenido",
            )
        cantidad = data.empaques * codigo.factor
        # Constancia del empaque original, para auditar contra la factura.
        envase = codigo.nombre_empaque or "empaque"
        plural = "s" if data.empaques != 1 and not envase.endswith("s") else ""
        detalle = (
            f"Compra: {_num(data.empaques)} {envase}{plural} "
            f"de {_num(codigo.factor)} {variante.unidad}"
        )
        if codigo.proveedor:
            detalle += f" — {codigo.proveedor.nombre}"
        observaciones = f"{detalle} · {observaciones}" if observaciones else detalle
    else:
        if data.cantidad <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
            )
        cantidad = data.cantidad

    # El precio de la factura manda sobre el configurado: es el único momento en
    # que se conoce con certeza lo que costó el material.
    cambios = {"stock_actual": variante.stock_actual + cantidad}
    costo_unitario = variante.precio_compra
    if data.precio_total is not None:
        costo_unitario = data.precio_total / cantidad
        if data.actualizar_precio:
            cambios["precio_compra"] = costo_unitario

    # El proveedor sale del gesto que el bodeguero ya hizo —escanear la caja— y
    # sólo se pide cuando no hay código del cual deducirlo.
    proveedor_id = data.proveedor_id or (codigo.proveedor_id if codigo else None)

    await VarianteRepository(session, tenant_id).update(variante, **cambios)
    return await InventoryLogRepository(session, tenant_id).create(
        variante_id=variante.id,
        codigo_id=codigo.id if codigo else None,
        proveedor_id=proveedor_id,
        user_id=user_id,
        tipo_movimiento="compra",
        cantidad=cantidad,
        costo_unitario=costo_unitario,
        observaciones=observaciones,
    )


async def retirar(
    variante: Variante,
    data: VarianteWithdraw,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    comportamiento: str,
):
    """Descuenta stock y registra la entrega al operario.

    NO crea ningún registro en `loans`: un tornillo no se devuelve. Lo que sobra
    de una obra vuelve por reintegro, que es otro movimiento, no el cierre de un
    préstamo.
    """
    from app.models.project import Project
    from app.models.user import User
    from app.repositories.inventory_log import InventoryLogRepository

    if comportamiento != "consumible":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El item no es un consumible"
        )
    if data.cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
        )
    if variante.stock_actual < data.cantidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente")

    operario = await session.get(User, data.operario_id)
    if not operario or operario.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Operario no encontrado"
        )
    # Quien retira material en terreno es un operario. Aceptar a cualquier usuario
    # deja el material entregado a nombre de alguien que nunca lo recibió, y en un
    # mesón donde se opera con guantes elegir mal de la lista es cuestión de tiempo.
    if operario.role_id != ROL_OPERARIO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{operario.nombre} no es operario: el material se entrega a un operario",
        )

    # La obra es obligatoria, y tiene que estar abierta: imputar consumo a una obra
    # cerrada contradice que su costo ya se dio por final.
    proyecto = await session.get(Project, data.project_id)
    if not proyecto or proyecto.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado"
        )
    if not proyecto.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La obra '{proyecto.nombre}' está cerrada: no admite nuevos despachos",
        )

    await VarianteRepository(session, tenant_id).update(
        variante, stock_actual=variante.stock_actual - data.cantidad
    )
    # El costo se congela al momento del movimiento: si se recalculara desde la
    # variante, subir el precio mañana cambiaría lo que costó una obra del año pasado.
    return await InventoryLogRepository(session, tenant_id).create(
        variante_id=variante.id,
        user_id=user_id,
        operario_id=data.operario_id,
        project_id=data.project_id,
        tipo_movimiento="entrega",
        cantidad=data.cantidad,
        costo_unitario=variante.precio_compra,
        observaciones=data.observaciones,
    )


async def _descontar(
    variante: Variante,
    cantidad,
    tipo: str,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    comportamiento: str,
    project_id: int | None,
    observaciones: str | None,
    mensaje_sin_stock: str,
):
    """Merma y pérdida son el mismo movimiento con distinta causa.

    Se mantienen como tipos separados a propósito: si el robo se diluye dentro de
    la merma nadie lo ve, que es justo lo que el sistema existe para exponer.
    """
    from app.repositories.inventory_log import InventoryLogRepository

    if comportamiento != "consumible":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Solo aplica a consumibles"
        )
    if cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
        )
    if variante.stock_actual < cantidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=mensaje_sin_stock)

    await VarianteRepository(session, tenant_id).update(
        variante, stock_actual=variante.stock_actual - cantidad
    )
    return await InventoryLogRepository(session, tenant_id).create(
        variante_id=variante.id,
        user_id=user_id,
        project_id=project_id,
        tipo_movimiento=tipo,
        cantidad=cantidad,
        costo_unitario=variante.precio_compra,
        observaciones=observaciones,
    )


def _num(v) -> str:
    """Formatea una cantidad sin decimales inútiles: 100 y no 100.000."""
    return f"{v:f}".rstrip("0").rstrip(".") if "." in f"{v:f}" else f"{v:f}"


async def ajustar_stock(variante, data, session, tenant_id, user_id, *, comportamiento):
    """Fija el stock al valor contado y deja el movimiento que lo explica.

    Es la única vía para corregir existencias, y por eso no edita en silencio: la
    diferencia queda registrada con su magnitud. Un stock que salta sin movimiento
    convierte la bitácora en decoración.
    """
    from app.repositories.inventory_log import InventoryLogRepository

    if comportamiento != "consumible":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "El stock de una herramienta se ajusta dando de alta o baja sus "
                "ejemplares, no con un número"
            ),
        )
    if data.stock_nuevo < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El stock no puede ser negativo"
        )

    anterior = variante.stock_actual
    if data.stock_nuevo == anterior:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El stock ya es {_num(anterior)}: no hay nada que ajustar",
        )

    detalle = f"Ajuste: {_num(anterior)} → {_num(data.stock_nuevo)}"
    observaciones = f"{detalle} · {data.observaciones}" if data.observaciones else detalle

    await VarianteRepository(session, tenant_id).update(variante, stock_actual=data.stock_nuevo)
    return await InventoryLogRepository(session, tenant_id).create(
        variante_id=variante.id,
        user_id=user_id,
        tipo_movimiento="ajuste",
        # La magnitud de la diferencia, no el valor nuevo: el movimiento dice
        # cuánto cambió, y las observaciones de dónde a dónde.
        cantidad=abs(data.stock_nuevo - anterior),
        costo_unitario=variante.precio_compra,
        observaciones=observaciones,
    )


async def registrar_merma(variante, data, session, tenant_id, user_id, *, comportamiento):
    return await _descontar(
        variante, data.cantidad, "merma", session, tenant_id, user_id,
        comportamiento=comportamiento,
        project_id=data.project_id,
        observaciones=data.observaciones,
        mensaje_sin_stock="Stock insuficiente para registrar la merma",
    )


async def registrar_perdida(variante, data, session, tenant_id, user_id, *, comportamiento):
    return await _descontar(
        variante, data.cantidad, "perdida", session, tenant_id, user_id,
        comportamiento=comportamiento,
        project_id=data.project_id,
        observaciones=data.observaciones,
        mensaje_sin_stock="Stock insuficiente",
    )


async def reintegrar(
    variante: Variante,
    data: VarianteReintegro,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    comportamiento: str,
):
    """Devuelve al stock el material despachado que no se consumió.

    Se apoya en el despacho de origen para dos cosas: validar que no vuelva más de
    lo que salió, y heredar el proyecto y el operario, de modo que el consumo neto
    del proyecto quede bien imputado.
    """
    from app.models.project import Project
    from app.repositories.inventory_log import InventoryLogRepository

    log_repo = InventoryLogRepository(session, tenant_id)

    if data.cantidad <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0"
        )

    # El repo filtra por tenant: un despacho ajeno simplemente no aparece
    despacho = await log_repo.get(data.origen_log_id)
    if not despacho or despacho.variante_id != variante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho no encontrado")

    if comportamiento != "consumible" or despacho.tipo_movimiento != "entrega":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sólo se puede reintegrar contra despachos de consumibles",
        )

    # Un despacho admite un solo reintegro: el operario se lleva el material,
    # ocupa lo que ocupa y devuelve el sobrante en un viaje.
    if await log_repo.tiene_reintegro(despacho.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta entrega ya fue cerrada con un reintegro anterior",
        )

    # Obra terminada: lo que salió y no volvió quedó declarado como consumo
    if despacho.project_id is not None:
        proyecto = await session.get(Project, despacho.project_id)
        if proyecto and not proyecto.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"El proyecto '{proyecto.nombre}' está cerrado: "
                    "su material quedó declarado como consumo"
                ),
            )

    saldo = await log_repo.saldo_pendiente(despacho.id)
    if data.cantidad > saldo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No se puede reintegrar {data.cantidad}: "
                f"el despacho tiene un saldo pendiente de {saldo}"
            ),
        )

    await VarianteRepository(session, tenant_id).update(
        variante, stock_actual=variante.stock_actual + data.cantidad
    )
    return await log_repo.create(
        variante_id=variante.id,
        user_id=user_id,
        operario_id=despacho.operario_id,
        project_id=despacho.project_id,
        origen_log_id=despacho.id,
        tipo_movimiento="reintegro",
        cantidad=data.cantidad,
        costo_unitario=variante.precio_compra,
        observaciones=data.observaciones,
    )


# ── Eliminación validada por nivel ───────────────────────────────────────────


async def _contar_movimientos(session: AsyncSession, tenant_id: int, **filtro) -> int:
    from sqlalchemy import func, select

    from app.models.inventory_log import InventoryLog

    query = (
        select(func.count())
        .select_from(InventoryLog)
        .where(InventoryLog.tenant_id == tenant_id)
    )
    for campo, valor in filtro.items():
        query = query.where(getattr(InventoryLog, campo) == valor)
    return (await session.execute(query)).scalar_one()


async def validar_borrado_de_variante(
    variante: Variante, session: AsyncSession, tenant_id: int, comportamiento: str
) -> None:
    unidades = await VarianteRepository(session, tenant_id).contar_unidades(variante.id)
    if unidades:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: la variante tiene {unidades} unidad(es)",
        )
    if comportamiento == "consumible" and variante.stock_actual != 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: la variante tiene stock. Ajuste el stock a 0 primero",
        )
    # El historial de bodega es el activo que este sistema construye: borrarlo deja
    # la bitácora hablando de algo que ya no existe. Lo cargado por error y nunca
    # movido sí se borra.
    movimientos = await _contar_movimientos(session, tenant_id, variante_id=variante.id)
    if movimientos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: tiene {movimientos} movimiento(s) en la bitácora",
        )


async def validar_borrado_de_unidad(unidad, session: AsyncSession, tenant_id: int) -> None:
    from app.repositories.loan import LoanRepository

    if await LoanRepository(session, tenant_id).get_active_by_unidad(unidad.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: la unidad tiene un préstamo activo",
        )
    movimientos = await _contar_movimientos(session, tenant_id, unidad_id=unidad.id)
    if movimientos:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: tiene {movimientos} movimiento(s) en la bitácora",
        )


async def validar_borrado_de_producto(
    producto: Producto, session: AsyncSession, tenant_id: int
) -> None:
    variantes = await ProductoRepository(session, tenant_id).contar_variantes(producto.id)
    if variantes > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"No se puede eliminar: el producto tiene {variantes} variantes. "
                "Elimínelas primero"
            ),
        )
