from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.inventory_log import InventoryLogRepository
from app.schemas.inventory import InventoryLogResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/logs", response_model=list[InventoryLogResponse])
async def list_logs(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 100):
    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.list(offset=skip, limit=limit)


@router.get("/logs/asset/{asset_id}", response_model=list[InventoryLogResponse])
async def logs_by_asset(asset_id: int, token: CurrentToken, session: DBSession):
    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.list_by_asset(asset_id)
