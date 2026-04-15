from fastapi import APIRouter, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.asset import AssetRepository
from app.schemas.asset import AssetAdjust, AssetCreate, AssetLoss, AssetPurchase, AssetRepairDone, AssetShrinkage, AssetResponse, AssetUpdate
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
