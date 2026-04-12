from fastapi import APIRouter
from sqlalchemy import select

from app.core.dependencies import CurrentToken, DBSession
from app.models.inventory_log import InventoryLog
from app.models.user import User
from app.schemas.inventory import InventoryLogResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _log_query(tenant_id: int):
    return (
        select(InventoryLog, User.nombre.label("user_nombre"))
        .join(User, InventoryLog.user_id == User.id)
        .where(InventoryLog.tenant_id == tenant_id)
        .order_by(InventoryLog.fecha_hora.desc())
    )


def _to_response(log: InventoryLog, user_nombre: str) -> InventoryLogResponse:
    return InventoryLogResponse(
        **{c.key: getattr(log, c.key) for c in InventoryLog.__table__.columns},
        user_nombre=user_nombre,
    )


@router.get("/logs", response_model=list[InventoryLogResponse])
async def list_logs(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 100):
    result = await session.execute(
        _log_query(token.tenant_id).offset(skip).limit(limit)
    )
    return [_to_response(log, nombre) for log, nombre in result.all()]


@router.get("/logs/asset/{asset_id}", response_model=list[InventoryLogResponse])
async def logs_by_asset(asset_id: int, token: CurrentToken, session: DBSession):
    result = await session.execute(
        _log_query(token.tenant_id).where(InventoryLog.asset_id == asset_id)
    )
    return [_to_response(log, nombre) for log, nombre in result.all()]
