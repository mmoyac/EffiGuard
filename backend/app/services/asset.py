from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_state import AssetState
from app.models.project import Project
from app.repositories.asset import AssetRepository
from app.repositories.inventory_log import InventoryLogRepository
from app.repositories.loan import LoanRepository
from app.core.uid import generar_uid
from app.schemas.asset import AltaPorCodigo, AssetAdjust, AssetCreate, AssetLoss, AssetPurchase, AssetReintegro, AssetRepairDone, AssetShrinkage, AssetUpdate, ConsumableWithdraw
from app.schemas.inventory import InventoryLogResponse
from app.schemas.loan import LoanCreate


def _num(v) -> str:
    """Formatea una cantidad sin decimales inútiles: 100 y no 100.000."""
    return f"{v:f}".rstrip("0").rstrip(".") if "." in f"{v:f}" else f"{v:f}"


async def _validar_ubicacion(ubicacion_id: int | None, session: AsyncSession, tenant_id: int) -> None:
    """La ubicación debe existir dentro del tenant. El repo ya filtra por tenant_id,
    así que una ubicación ajena simplemente no se encuentra."""
    if ubicacion_id is None:
        return
    from app.repositories.ubicacion import UbicacionRepository

    if not await UbicacionRepository(session, tenant_id).get(ubicacion_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")


async def create_asset(data: AssetCreate, session: AsyncSession, tenant_id: int):
    from sqlalchemy.exc import IntegrityError
    repo = AssetRepository(session, tenant_id)
    await _validar_ubicacion(data.ubicacion_id, session, tenant_id)
    try:
        asset = await repo.create(**data.model_dump())
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un activo con el código '{data.uid_fisico}'",
        )
    return await repo.get_with_children(asset.id)


async def update_asset(asset_id: int, data: AssetUpdate, session: AsyncSession, tenant_id: int):
    repo = AssetRepository(session, tenant_id)
    asset = await repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    cambios = data.model_dump(exclude_unset=True)
    if "ubicacion_id" in cambios:
        await _validar_ubicacion(cambios["ubicacion_id"], session, tenant_id)
    await repo.update(asset, **cambios)
    return await repo.get_with_children(asset_id)


# Orden de las candidatas: el bodeguero está entregando o recibiendo, no
# consultando inventario, así que lo operable va primero.
_PRIORIDAD_ESTADO = {1: 0, 2: 1}  # 1 Disponible, 2 En Terreno


async def _expandir(asset, repo: AssetRepository):
    """Un activo raíz se devuelve con sus hijos (kit); un hijo, solo."""
    if asset.parent_asset_id is None:
        return await repo.get_with_children(asset.id)
    return asset


async def scan_asset(codigo: str, session: AsyncSession, tenant_id: int) -> dict:
    """Resuelve un código escaneado en dos pasos.

    Primero busca uid_fisico (identifica UNA unidad), y sólo si no hay coincidencia
    busca codigo_fabricante (identifica un PRODUCTO, y puede dar varias unidades).
    El orden importa: un consumible puede tener el EAN cargado como su uid_fisico y
    a la vez existir herramientas con ese código de fábrica; gana lo más específico.
    """
    repo = AssetRepository(session, tenant_id)

    asset = await repo.get_by_uid(codigo)
    if asset:
        return {"tipo": "unico", "asset": await _expandir(asset, repo)}

    candidatos = await repo.get_by_codigo_fabricante(codigo)
    if not candidatos:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")

    # Una sola unidad no justifica pedirle al operador que elija de una lista de uno
    if len(candidatos) == 1:
        return {"tipo": "unico", "asset": await _expandir(candidatos[0], repo)}

    candidatos.sort(key=lambda a: (_PRIORIDAD_ESTADO.get(a.estado_id, 2), a.uid_fisico))
    return {
        "tipo": "multiple",
        "codigo_fabricante": codigo.strip().upper(),
        "candidatos": candidatos,
    }


async def preview_producto(codigo: str, session: AsyncSession, tenant_id: int):
    """Qué producto se clonaría al dar de alta unidades con este código."""
    repo = AssetRepository(session, tenant_id)
    existentes = await repo.get_by_codigo_fabricante(codigo)
    if not existentes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay unidades registradas con ese código de fabricante",
        )
    ref = max(existentes, key=lambda a: a.id)
    return {
        "codigo_fabricante": ref.codigo_fabricante,
        "nombre": ref.nombre,
        "family_id": ref.family_id,
        "unidad": ref.unidad,
        "valor_reposicion": ref.valor_reposicion,
        "dias_max_prestamo": ref.dias_max_prestamo,
        "unidades_existentes": len(existentes),
    }


async def crear_unidades_por_codigo(data: AltaPorCodigo, session: AsyncSession, tenant_id: int):
    """Da de alta N unidades clonando el producto ya conocido.

    Se clona la unidad más reciente porque no existe una entidad 'producto': es la
    mejor aproximación a los atributos vigentes. La ubicación NO se hereda — la
    herramienta que acaba de llegar todavía no está guardada en ninguna parte, y
    heredarla afirmaría algo falso.
    """
    repo = AssetRepository(session, tenant_id)

    existentes = await repo.get_by_codigo_fabricante(data.codigo_fabricante)
    if not existentes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay unidades registradas con ese código de fabricante",
        )

    ref = max(existentes, key=lambda a: a.id)
    usados = await repo.uids_existentes()

    creadas = []
    for _ in range(data.cantidad):
        uid = generar_uid(usados)
        usados.add(uid)
        nueva = await repo.create(
            uid_fisico=uid,
            codigo_fabricante=ref.codigo_fabricante,
            nombre=ref.nombre,
            family_id=ref.family_id,
            model_id=ref.model_id,
            estado_id=1,  # Disponible: recién llegada a bodega
            unidad=ref.unidad,
            valor_reposicion=ref.valor_reposicion,
            dias_max_prestamo=ref.dias_max_prestamo,
        )
        creadas.append(nueva.id)

    # Recargar con relaciones para poder serializar AssetResponse
    return [await repo.get_with_children(i) for i in creadas]


async def withdraw_consumable(data: ConsumableWithdraw, session: AsyncSession, tenant_id: int, user_id: int):
    """Retira cantidad de un consumible: descuenta stock y genera log."""
    from sqlalchemy import select
    from app.models.user import User

    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(data.asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.family.comportamiento != "consumible":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El activo no es un consumible")
    if asset.stock_actual < data.cantidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente")

    operario = await session.get(User, data.operario_id)
    if not operario or operario.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operario no encontrado")

    await asset_repo.update(asset, stock_actual=asset.stock_actual - data.cantidad)
    log = await log_repo.create(
        asset_id=data.asset_id,
        user_id=user_id,
        operario_id=data.operario_id,
        project_id=data.project_id,
        tipo_movimiento="entrega",
        cantidad=data.cantidad,
        observaciones=data.observaciones,
    )
    return InventoryLogResponse(
        **{c.key: getattr(log, c.key) for c in log.__table__.columns},
        operario_nombre=operario.nombre,
    )


async def report_loss(asset_id: int, data: AssetLoss, session: AsyncSession, tenant_id: int, user_id: int):
    """Registra pérdida/robo. Prestable → estado Robado. Consumible → descuenta stock."""
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")

    if asset.family.comportamiento == "prestable":
        await asset_repo.update(asset, estado_id=4)  # 4 = Robado
        cantidad = 1
    else:
        if asset.stock_actual < data.cantidad:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente")
        await asset_repo.update(asset, stock_actual=asset.stock_actual - data.cantidad)
        cantidad = data.cantidad

    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        tipo_movimiento="perdida",
        cantidad=cantidad,
        project_id=data.project_id,
        observaciones=data.observaciones,
    )


async def adjust_stock(asset_id: int, data: AssetAdjust, session: AsyncSession, tenant_id: int, user_id: int):
    """Ajuste de inventario: establece stock absoluto y registra la diferencia en el log."""
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.family.comportamiento != "consumible":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo aplica a consumibles")

    diferencia = data.stock_nuevo - asset.stock_actual
    await asset_repo.update(asset, stock_actual=data.stock_nuevo)
    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        tipo_movimiento="ajuste",
        cantidad=abs(diferencia),
        observaciones=data.observaciones or (f"Ajuste: {asset.stock_actual} → {data.stock_nuevo}"),
    )


async def repair_done(asset_id: int, data: AssetRepairDone, session: AsyncSession, tenant_id: int, user_id: int):
    """Marca la herramienta como reparada: vuelve a Disponible y registra log."""
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.estado_id != 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El activo no está en estado 'En Reparación'")

    await asset_repo.update(asset, estado_id=1)  # 1 = Disponible
    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        tipo_movimiento="reparacion_completada",
        cantidad=1,
        observaciones=data.observaciones,
    )


async def purchase_stock(asset_id: int, data: AssetPurchase, session: AsyncSession, tenant_id: int, user_id: int):
    """Ingresa una compra: suma al stock y registra log tipo 'compra'.

    La compra se puede expresar en unidades de stock o en empaques (cajas, rollos),
    pero el movimiento SIEMPRE se registra en la unidad de stock: es lo que mantiene
    la bitácora homogénea y el consumo por proyecto comparable.
    """
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    if (data.cantidad is None) == (data.empaques is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe enviar exactamente uno: 'cantidad' (unidades) o 'empaques'",
        )

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.family.comportamiento != "consumible":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo aplica a consumibles")

    observaciones = data.observaciones

    if data.empaques is not None:
        if data.empaques <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0")
        if not asset.contenido_por_empaque:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El activo no tiene configurado el contenido por empaque",
            )
        cantidad = data.empaques * asset.contenido_por_empaque
        # Constancia del empaque original, para auditar contra la factura
        envase = asset.nombre_empaque or "empaque"
        detalle = (
            f"Compra: {_num(data.empaques)} {envase}"
            f"{'s' if data.empaques != 1 and not envase.endswith('s') else ''}"
            f" de {_num(asset.contenido_por_empaque)} {asset.unidad}"
        )
        observaciones = f"{detalle} — {observaciones}" if observaciones else detalle
    else:
        if data.cantidad <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0")
        cantidad = data.cantidad

    # El precio de la factura manda sobre el configurado: es el único momento en
    # que se conoce con certeza lo que costó el material.
    cambios = {"stock_actual": asset.stock_actual + cantidad}
    costo_unitario = asset.precio_compra
    if data.precio_total is not None:
        costo_unitario = data.precio_total / cantidad
        if data.actualizar_precio:
            # Sin esto el precio se congela: se carga una vez y sigue valorizando
            # consumo con un valor de hace dos años que nadie recuerda actualizar.
            cambios["precio_compra"] = costo_unitario

    await asset_repo.update(asset, **cambios)
    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        tipo_movimiento="compra",
        cantidad=cantidad,
        costo_unitario=costo_unitario,
        observaciones=observaciones,
    )


async def shrinkage_stock(asset_id: int, data: AssetShrinkage, session: AsyncSession, tenant_id: int, user_id: int):
    """Registra merma: descuenta cantidad por daño, vencimiento o corrección de conteo."""
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.family.comportamiento != "consumible":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo aplica a consumibles")
    if data.cantidad <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0")
    if asset.stock_actual < data.cantidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente para registrar la merma")

    await asset_repo.update(asset, stock_actual=asset.stock_actual - data.cantidad)
    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        tipo_movimiento="merma",
        cantidad=data.cantidad,
        project_id=data.project_id,
        observaciones=data.observaciones,
    )


async def reintegrar(asset_id: int, data: AssetReintegro, session: AsyncSession, tenant_id: int, user_id: int):
    """Devuelve al stock el material despachado que no se consumió.

    Se apoya en el despacho de origen para dos cosas: validar que no vuelva más de
    lo que salió, y heredar el proyecto y el operario, de modo que el consumo neto
    del proyecto quede bien imputado.
    """
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if data.cantidad <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0")

    # El repo filtra por tenant: un despacho ajeno simplemente no aparece
    despacho = await log_repo.get(data.origen_log_id)
    if not despacho or despacho.asset_id != asset_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho no encontrado")

    if asset.family.comportamiento != "consumible" or despacho.tipo_movimiento != "entrega":
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
                detail=f"El proyecto '{proyecto.nombre}' está cerrado: su material quedó declarado como consumo",
            )

    saldo = await log_repo.saldo_pendiente(despacho.id)
    if data.cantidad > saldo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede reintegrar {data.cantidad}: el despacho tiene un saldo pendiente de {saldo}",
        )

    await asset_repo.update(asset, stock_actual=asset.stock_actual + data.cantidad)
    return await log_repo.create(
        asset_id=asset_id,
        user_id=user_id,
        operario_id=despacho.operario_id,
        project_id=despacho.project_id,
        origen_log_id=despacho.id,
        tipo_movimiento="reintegro",
        cantidad=data.cantidad,
        observaciones=data.observaciones,
    )


async def create_loan(data: LoanCreate, session: AsyncSession, tenant_id: int, bodeguero_id: int):
    """Crea préstamo para activo prestable o kit completo (padre → todos los hijos)."""
    asset_repo = AssetRepository(session, tenant_id)
    loan_repo = LoanRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get_with_children(data.asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.family.comportamiento != "prestable":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use el endpoint de consumibles para retirar consumibles")

    if await loan_repo.get_active_by_asset(asset.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El activo ya tiene un préstamo activo")

    loans = []
    assets_to_loan = [asset] + list(asset.children)

    for a in assets_to_loan:
        loan = await loan_repo.create(
            asset_id=a.id,
            user_id=data.user_id,
            bodeguero_id=bodeguero_id,
            project_id=data.project_id,
            fecha_devolucion_prevista=data.fecha_devolucion_prevista,
        )
        await asset_repo.update(a, estado_id=2)  # 2 = En Terreno
        await log_repo.create(
            asset_id=a.id,
            user_id=bodeguero_id,
            tipo_movimiento="entrega",
            cantidad=1,
        )
        loans.append(loan)

    return loans
