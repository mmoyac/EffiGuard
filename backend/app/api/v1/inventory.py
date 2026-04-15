from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import aliased

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset import Asset
from app.models.asset_family import AssetFamily
from app.models.inventory_log import InventoryLog
from app.models.user import User
from app.schemas.inventory import InventoryLogResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])

Bodeguero = aliased(User, name="bodeguero")
Operario = aliased(User, name="operario")


def _log_query(tenant_id: int):
    return (
        select(
            InventoryLog,
            User.nombre.label("user_nombre"),
            Operario.nombre.label("operario_nombre"),
            Asset.nombre.label("asset_nombre"),
            Asset.uid_fisico.label("asset_uid"),
            AssetFamily.comportamiento.label("asset_tipo"),
            AssetFamily.color.label("asset_color"),
        )
        .join(User, InventoryLog.user_id == User.id)
        .outerjoin(Operario, InventoryLog.operario_id == Operario.id)
        .join(Asset, InventoryLog.asset_id == Asset.id)
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .where(InventoryLog.tenant_id == tenant_id)
        .order_by(InventoryLog.fecha_hora.desc())
    )


def _to_response(row) -> InventoryLogResponse:
    log = row[0]
    return InventoryLogResponse(
        **{c.key: getattr(log, c.key) for c in InventoryLog.__table__.columns},
        user_nombre=row.user_nombre,
        operario_nombre=row.operario_nombre,
        asset_nombre=row.asset_nombre,
        asset_uid=row.asset_uid,
        asset_tipo=row.asset_tipo,
        asset_color=row.asset_color,
    )


@router.get("/logs", response_model=list[InventoryLogResponse])
async def list_logs(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 200):
    result = await session.execute(
        _log_query(token.tenant_id).offset(skip).limit(limit)
    )
    return [_to_response(row) for row in result.all()]


@router.get("/logs/asset/{asset_id}", response_model=list[InventoryLogResponse])
async def logs_by_asset(asset_id: int, token: CurrentToken, session: DBSession):
    result = await session.execute(
        _log_query(token.tenant_id).where(InventoryLog.asset_id == asset_id)
    )
    return [_to_response(row) for row in result.all()]
