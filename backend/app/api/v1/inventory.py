from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import aliased

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset_family import AssetFamily
from app.models.codigo import Codigo
from app.models.inventory_log import InventoryLog
from app.models.producto import Producto
from app.models.project import Project
from app.models.user import User
from app.models.variante import Variante
from app.schemas.inventory import InventoryLogResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])

Bodeguero = aliased(User, name="bodeguero")
Operario = aliased(User, name="operario")


def _log_query(tenant_id: int):
    """Bitácora sobre el catálogo producto → variante → unidad.

    El código escaneado se muestra en la columna del identificador: es lo que
    permite auditar una compra contra la factura del proveedor.
    """
    return (
        select(
            InventoryLog,
            User.nombre.label("user_nombre"),
            Operario.nombre.label("operario_nombre"),
            (Producto.nombre + " · " + Variante.nombre).label("asset_nombre"),
            Codigo.codigo.label("asset_uid"),
            Variante.unidad.label("asset_unidad"),
            AssetFamily.comportamiento.label("asset_tipo"),
            AssetFamily.color.label("asset_color"),
            Project.nombre.label("proyecto_nombre"),
        )
        .join(User, InventoryLog.user_id == User.id)
        .outerjoin(Operario, InventoryLog.operario_id == Operario.id)
        .outerjoin(Project, InventoryLog.project_id == Project.id)
        .join(Variante, InventoryLog.variante_id == Variante.id)
        .join(Producto, Variante.producto_id == Producto.id)
        .join(AssetFamily, Producto.family_id == AssetFamily.id)
        .outerjoin(Codigo, InventoryLog.codigo_id == Codigo.id)
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
        asset_unidad=row.asset_unidad,
        asset_tipo=row.asset_tipo,
        asset_color=row.asset_color,
        proyecto_nombre=row.proyecto_nombre,
    )


@router.get("/logs", response_model=list[InventoryLogResponse])
async def list_logs(token: CurrentToken, session: DBSession, skip: int = 0, limit: int = 200):
    result = await session.execute(
        _log_query(token.tenant_id).offset(skip).limit(limit)
    )
    return [_to_response(row) for row in result.all()]


@router.get("/logs/variante/{variante_id}", response_model=list[InventoryLogResponse])
async def logs_by_variante(variante_id: int, token: CurrentToken, session: DBSession):
    result = await session.execute(
        _log_query(token.tenant_id).where(InventoryLog.variante_id == variante_id)
    )
    return [_to_response(row) for row in result.all()]
