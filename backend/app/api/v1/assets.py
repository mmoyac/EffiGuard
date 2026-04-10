from fastapi import APIRouter, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.asset import AssetRepository
from app.schemas.asset import AssetCreate, AssetResponse, AssetUpdate
from app.services import asset as asset_service

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/", response_model=list[AssetResponse])
async def list_assets(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 50):
    repo = AssetRepository(session, token.tenant_id)
    return await repo.list(offset=skip, limit=limit)


@router.post("/", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
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
