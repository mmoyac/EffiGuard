from fastapi import APIRouter, status

from app.core.dependencies import ApiKeyTenant, CurrentToken, DBSession
from app.repositories.asset import AssetRepository
from app.schemas.asset import AltaPorCodigo, AssetAdjust, AssetCreate, AssetLoss, AssetPurchase, AssetReintegro, AssetRepairDone, AssetShrinkage, AssetResponse, AssetUpdate, AssetQueryResult, ProductoPreview, ScanResolution
from app.schemas.inventory import ConsumoProyectoResponse, DespachoPendienteResponse, InventoryLogResponse
from app.services import asset as asset_service

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("", response_model=list[AssetResponse])
async def list_assets(
    token: CurrentToken,
    session: DBSession,
    skip: int = 0,
    limit: int = 50,
    comportamiento: str | None = None,
    ubicacion_rack: str | None = None,
    ubicacion_id: int | None = None,
):
    repo = AssetRepository(session, token.tenant_id)
    return await repo.list_filtered(
        comportamiento=comportamiento,
        ubicacion_rack=ubicacion_rack,
        ubicacion_id=ubicacion_id,
        offset=skip,
        limit=limit,
    )


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(data: AssetCreate, token: CurrentToken, session: DBSession):
    return await asset_service.create_asset(data, session, token.tenant_id)


@router.get("/query", response_model=list[AssetQueryResult])
async def query_assets(q: str, tenant_id: ApiKeyTenant, session: DBSession):
    """Consulta disponibilidad por nombre. Autenticación via X-API-Key (para n8n/agentes).
    Ej: ?q=taladro → herramientas disponibles/en terreno.
    Ej: ?q=tornillo → stock actual de consumibles."""
    from sqlalchemy import select
    from app.models.asset import Asset
    from app.models.asset_family import AssetFamily
    from app.models.asset_state import AssetState
    from app.models.loan import Loan
    from app.models.ubicacion import Ubicacion
    from app.models.user import User

    stmt = (
        select(
            Asset,
            AssetFamily.comportamiento,
            AssetState.nombre.label("estado_nombre"),
            User.nombre.label("operario_nombre"),
            Loan.fecha_entrega.label("fecha_prestamo"),
            Ubicacion.rack.label("ubic_rack"),
            Ubicacion.nivel.label("ubic_nivel"),
            Ubicacion.posicion.label("ubic_posicion"),
        )
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .join(AssetState, Asset.estado_id == AssetState.id)
        .outerjoin(Ubicacion, Asset.ubicacion_id == Ubicacion.id)
        .outerjoin(
            Loan,
            (Loan.asset_id == Asset.id) & Loan.fecha_devolucion_real.is_(None),
        )
        .outerjoin(User, User.id == Loan.user_id)
        .where(
            Asset.tenant_id == tenant_id,
            Asset.nombre.ilike(f"%{q}%"),
            Asset.parent_asset_id.is_(None),
        )
    )
    rows = (await session.execute(stmt)).all()

    # La ubicación va en ambas ramas: al agente le preguntan tanto "¿hay?" como
    # "¿dónde está?", y con esto responde lo segundo sin otra consulta.
    return [
        AssetQueryResult(
            nombre=r.Asset.nombre, tipo=r.comportamiento,
            estado=r.estado_nombre, operario=r.operario_nombre,
            fecha_prestamo=r.fecha_prestamo.strftime("%d/%m/%Y %H:%M") if r.fecha_prestamo else None,
            ubicacion_rack=r.ubic_rack, ubicacion_nivel=r.ubic_nivel, ubicacion_posicion=r.ubic_posicion,
        )
        if r.comportamiento == "prestable" else
        AssetQueryResult(
            nombre=r.Asset.nombre, tipo=r.comportamiento,
            stock_actual=r.Asset.stock_actual, stock_minimo=r.Asset.stock_minimo,
            unidad=r.Asset.unidad,
            bajo_stock=r.Asset.stock_actual <= r.Asset.stock_minimo,
            ubicacion_rack=r.ubic_rack, ubicacion_nivel=r.ubic_nivel, ubicacion_posicion=r.ubic_posicion,
        )
        for r in rows
    ]


@router.get("/scan/{codigo}", response_model=ScanResolution)
async def scan_asset(codigo: str, token: CurrentToken, session: DBSession):
    """Resuelve un escaneo QR/RFID/código de barras.

    Devuelve `tipo: unico` con el activo (con sus hijos si es kit padre), o
    `tipo: multiple` con las unidades candidatas cuando el código escaneado es un
    código de fábrica compartido por varias.
    """
    return await asset_service.scan_asset(codigo, session, token.tenant_id)


@router.get("/producto/{codigo}", response_model=ProductoPreview)
async def producto_preview(codigo: str, token: CurrentToken, session: DBSession):
    """Qué producto se clonaría al dar de alta unidades con este código de fábrica."""
    return await asset_service.preview_producto(codigo, session, token.tenant_id)


@router.post("/from-codigo-fabricante", response_model=list[AssetResponse], status_code=status.HTTP_201_CREATED)
async def crear_por_codigo(data: AltaPorCodigo, token: CurrentToken, session: DBSession):
    """Alta rápida al comprar: escanea el código de fábrica y crea N unidades
    clonando el producto, cada una con su UID generado y lista para etiquetar."""
    return await asset_service.crear_unidades_por_codigo(data, session, token.tenant_id)


@router.get("/low-stock", response_model=list[AssetResponse])
async def low_stock(token: CurrentToken, session: DBSession):
    repo = AssetRepository(session, token.tenant_id)
    return await repo.list_low_stock()


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: int, token: CurrentToken, session: DBSession):
    repo = AssetRepository(session, token.tenant_id)
    from fastapi import HTTPException
    asset = await repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: int, token: CurrentToken, session: DBSession):
    from fastapi import HTTPException
    from app.models.loan import Loan
    from app.models.inventory_log import InventoryLog
    from sqlalchemy import select, delete as sql_delete
    repo = AssetRepository(session, token.tenant_id)
    asset = await repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    active_loan = await session.execute(
        select(Loan).where(Loan.asset_id == asset_id, Loan.fecha_devolucion_real.is_(None))
    )
    if active_loan.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede eliminar: el activo tiene un préstamo activo")
    await session.execute(sql_delete(InventoryLog).where(InventoryLog.asset_id == asset_id))
    await session.execute(sql_delete(Loan).where(Loan.asset_id == asset_id))
    await repo.delete(asset)
    await session.commit()

@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(asset_id: int, data: AssetUpdate, token: CurrentToken, session: DBSession):
    return await asset_service.update_asset(asset_id, data, session, token.tenant_id)


@router.post("/{asset_id}/loss", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def report_loss(asset_id: int, data: AssetLoss, token: CurrentToken, session: DBSession):
    """Registra pérdida o robo. Herramienta → estado Robado. Consumible → descuenta stock."""
    return await asset_service.report_loss(asset_id, data, session, token.tenant_id, token.user_id)


@router.post("/{asset_id}/adjust", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def adjust_stock(asset_id: int, data: AssetAdjust, token: CurrentToken, session: DBSession):
    """Ajusta el stock de un consumible a un valor absoluto."""
    return await asset_service.adjust_stock(asset_id, data, session, token.tenant_id, token.user_id)


@router.post("/{asset_id}/purchase", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def purchase_stock(asset_id: int, data: AssetPurchase, token: CurrentToken, session: DBSession):
    """Registra una compra: suma unidades al stock del consumible."""
    return await asset_service.purchase_stock(asset_id, data, session, token.tenant_id, token.user_id)


@router.post("/{asset_id}/shrinkage", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def shrinkage_stock(asset_id: int, data: AssetShrinkage, token: CurrentToken, session: DBSession):
    """Registra merma: descuenta unidades por daño, vencimiento o corrección de conteo hacia abajo."""
    return await asset_service.shrinkage_stock(asset_id, data, session, token.tenant_id, token.user_id)


@router.post("/{asset_id}/repair-done", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def repair_done(asset_id: int, data: AssetRepairDone, token: CurrentToken, session: DBSession):
    """Marca la herramienta como reparada: cambia estado a Disponible y registra log."""
    return await asset_service.repair_done(asset_id, data, session, token.tenant_id, token.user_id)


@router.get("/{asset_id}/despachos-pendientes", response_model=list[DespachoPendienteResponse])
async def despachos_pendientes(asset_id: int, token: CurrentToken, session: DBSession):
    """Entregas de este consumible que todavía admiten reintegro: sin devolución
    previa y de proyecto activo. Más recientes primero."""
    from app.repositories.inventory_log import InventoryLogRepository

    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.despachos_abiertos(asset_id)


@router.post("/{asset_id}/reintegro", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def reintegro(asset_id: int, data: AssetReintegro, token: CurrentToken, session: DBSession):
    """Devuelve al stock el sobrante de un despacho. No es compra ni pérdida:
    lo que no vuelve queda como consumo real del proyecto."""
    return await asset_service.reintegrar(asset_id, data, session, token.tenant_id, token.user_id)


@router.get("/{asset_id}/consumo-por-proyecto", response_model=list[ConsumoProyectoResponse])
async def consumo_por_proyecto(asset_id: int, token: CurrentToken, session: DBSession):
    """Consumo neto de este consumible por proyecto: despachado menos reintegrado."""
    from app.repositories.inventory_log import InventoryLogRepository

    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.consumo_por_proyecto(asset_id)
