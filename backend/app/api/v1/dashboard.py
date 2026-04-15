"""Endpoints de estadísticas para el Dashboard."""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset import Asset
from app.models.asset_family import AssetFamily
from app.models.asset_state import AssetState
from app.models.inventory_log import InventoryLog
from app.models.loan import Loan
from app.models.user import User

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
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .where(Asset.tenant_id == tid)
        .where(AssetFamily.comportamiento == "consumible")
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


@router.get("/low-stock-detail")
async def low_stock_detail(token: CurrentToken, session: DBSession):
    """Activos consumibles con stock por debajo del mínimo."""
    rows = (await session.execute(
        sa.select(
            Asset.id,
            Asset.uid_fisico,
            Asset.nombre,
            Asset.stock_actual,
            Asset.stock_minimo,
            AssetFamily.nombre.label("family_nombre"),
            AssetFamily.color.label("family_color"),
        )
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .where(Asset.tenant_id == token.tenant_id)
        .where(AssetFamily.comportamiento == "consumible")
        .where(Asset.stock_actual <= Asset.stock_minimo)
        .order_by(Asset.stock_actual.asc())
    )).all()

    return [
        {
            "id": r.id,
            "uid_fisico": r.uid_fisico,
            "nombre": r.nombre,
            "stock_actual": r.stock_actual,
            "stock_minimo": r.stock_minimo,
            "family_nombre": r.family_nombre,
            "family_color": r.family_color,
        }
        for r in rows
    ]


@router.get("/overdue-loans")
async def overdue_loans(token: CurrentToken, session: DBSession):
    """Préstamos activos que superaron el límite de días de su activo o familia."""
    Operario = sa.orm.aliased(User, name="operario")

    rows = (await session.execute(
        sa.select(
            Loan.id.label("loan_id"),
            Loan.fecha_entrega,
            Asset.id.label("asset_id"),
            Asset.uid_fisico,
            Asset.nombre.label("asset_nombre"),
            Asset.dias_max_prestamo.label("asset_dias"),
            AssetFamily.dias_max_prestamo.label("family_dias"),
            AssetFamily.nombre.label("family_nombre"),
            AssetFamily.color.label("family_color"),
            Operario.nombre.label("user_nombre"),
        )
        .join(Asset, Loan.asset_id == Asset.id)
        .join(AssetFamily, Asset.family_id == AssetFamily.id)
        .join(Operario, Loan.user_id == Operario.id)
        .where(Loan.tenant_id == token.tenant_id)
        .where(Loan.fecha_devolucion_real.is_(None))
        .where(
            sa.or_(
                Asset.dias_max_prestamo.isnot(None),
                AssetFamily.dias_max_prestamo.isnot(None),
            )
        )
    )).all()

    now = datetime.now(timezone.utc)
    result = []
    for r in rows:
        # Herencia: activo override → familia → sin límite
        limite = r.asset_dias if r.asset_dias is not None else r.family_dias
        if limite is None:
            continue
        dias_transcurridos = (now - r.fecha_entrega.replace(tzinfo=timezone.utc)).days
        if dias_transcurridos > limite:
            result.append({
                "loan_id": r.loan_id,
                "asset_id": r.asset_id,
                "uid_fisico": r.uid_fisico,
                "asset_nombre": r.asset_nombre,
                "family_nombre": r.family_nombre,
                "family_color": r.family_color,
                "user_nombre": r.user_nombre,
                "dias_transcurridos": dias_transcurridos,
                "dias_max": limite,
                "dias_excedido": dias_transcurridos - limite,
                "fecha_entrega": r.fecha_entrega.isoformat(),
            })

    result.sort(key=lambda x: x["dias_excedido"], reverse=True)
    return result
