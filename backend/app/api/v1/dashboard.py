"""Endpoints de estadísticas para el Dashboard."""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset import Asset
from app.models.asset_state import AssetState
from app.models.inventory_log import InventoryLog
from app.models.loan import Loan

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(token: CurrentToken, session: DBSession):
    """KPIs rápidos: totales de activos, préstamos activos y stock bajo."""
    tid = token.tenant_id

    total_assets = (await session.execute(
        sa.select(sa.func.count()).select_from(Asset).where(Asset.tenant_id == tid)
    )).scalar()

    active_loans = (await session.execute(
        sa.select(sa.func.count()).select_from(Loan)
        .where(Loan.tenant_id == tid)
        .where(Loan.fecha_devolucion_real.is_(None))
    )).scalar()

    low_stock = (await session.execute(
        sa.select(sa.func.count()).select_from(Asset)
        .where(Asset.tenant_id == tid)
        .where(Asset.tipo == "consumible")
        .where(Asset.stock_actual <= Asset.stock_minimo)
    )).scalar()

    return {
        "total_assets": total_assets,
        "active_loans": active_loans,
        "low_stock": low_stock,
    }


@router.get("/assets-by-state")
async def assets_by_state(token: CurrentToken, session: DBSession):
    """Distribución de activos por estado para gráfico donut."""
    rows = (await session.execute(
        sa.select(AssetState.nombre, sa.func.count(Asset.id).label("count"))
        .join(Asset, Asset.estado_id == AssetState.id)
        .where(Asset.tenant_id == token.tenant_id)
        .group_by(AssetState.nombre)
    )).all()

    return [{"estado": r.nombre, "count": r.count} for r in rows]


@router.get("/loans-last-days")
async def loans_last_days(token: CurrentToken, session: DBSession, days: int = 7):
    """Préstamos creados por día en los últimos N días para gráfico de barras."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (await session.execute(
        sa.select(
            sa.func.date(Loan.fecha_entrega).label("dia"),
            sa.func.count(Loan.id).label("count"),
        )
        .where(Loan.tenant_id == token.tenant_id)
        .where(Loan.fecha_entrega >= since)
        .group_by(sa.func.date(Loan.fecha_entrega))
        .order_by(sa.func.date(Loan.fecha_entrega))
    )).all()

    # Rellenar días sin actividad con 0
    result = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result[d] = 0
    for r in rows:
        result[str(r.dia)] = r.count

    return [{"dia": k, "prestamos": v} for k, v in result.items()]


@router.get("/inventory-last-days")
async def inventory_last_days(token: CurrentToken, session: DBSession, days: int = 30):
    """Movimientos de inventario por día en los últimos N días para gráfico de línea."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (await session.execute(
        sa.select(
            sa.func.date(InventoryLog.fecha_hora).label("dia"),
            sa.func.sum(InventoryLog.cantidad).label("cantidad"),
        )
        .where(InventoryLog.tenant_id == token.tenant_id)
        .where(InventoryLog.fecha_hora >= since)
        .group_by(sa.func.date(InventoryLog.fecha_hora))
        .order_by(sa.func.date(InventoryLog.fecha_hora))
    )).all()

    result = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        result[d] = 0
    for r in rows:
        result[str(r.dia)] = int(r.cantidad or 0)

    return [{"dia": k, "cantidad": v} for k, v in result.items()]
