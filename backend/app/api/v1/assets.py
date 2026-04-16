from fastapi import APIRouter, status

from app.core.dependencies import ApiKeyTenant, CurrentToken, DBSession
from app.repositories.asset import AssetRepository
from app.schemas.asset import AssetAdjust, AssetCreate, AssetLoss, AssetPurchase, AssetRepairDone, AssetShrinkage, AssetResponse, AssetUpdate, AssetQueryResult
from app.schemas.inventory import InventoryLogResponse
from app.services import asset as asset_service

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("", response_model=list[AssetResponse])
async def list_assets(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 50):
    repo = AssetRepository(session, token.tenant_id)
    return await repo.list(offset=skip, limit=limit)


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
    from app.models.user import User

    stmt = (
        select(
            Asset,
            AssetFamily.comportamiento,
            AssetState.nombre.label("estado_nombre"),
            User.nombre.label("operario_nombre"),
            Loan.fecha_entrega.label("fecha_prestamo"),
        )
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .join(AssetState, Asset.estado_id == AssetState.id)
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

    return [
        AssetQueryResult(
            nombre=asset.nombre, tipo=comportamiento,
            estado=estado_nombre, operario=operario_nombre,
            fecha_prestamo=fecha_prestamo.strftime("%d/%m/%Y %H:%M") if fecha_prestamo else None,
        )
        if comportamiento == "prestable" else
        AssetQueryResult(
            nombre=asset.nombre, tipo=comportamiento,
            stock_actual=asset.stock_actual, stock_minimo=asset.stock_minimo,
            bajo_stock=asset.stock_actual <= asset.stock_minimo,
        )
        for asset, comportamiento, estado_nombre, operario_nombre, fecha_prestamo in rows
    ]


@router.get("/scan/{uid_fisico}", response_model=AssetResponse)
async def scan_asset(uid_fisico: str, token: CurrentToken, session: DBSession):
    """Resuelve un escaneo QR/RFID. Si es kit padre, incluye hijos."""
    return await asset_service.scan_asset(uid_fisico, session, token.tenant_id)


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
