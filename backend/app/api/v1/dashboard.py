"""Endpoints de estadísticas para el Dashboard."""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset_family import AssetFamily
from app.models.asset_state import AssetState
from app.models.inventory_log import InventoryLog
from app.models.loan import MODALIDAD_A_CARGO, Loan
from app.models.user import User
from app.models.unidad import Unidad
from app.models.variante import Variante
from app.repositories.variante import VarianteRepository
from app.schemas.inventory import (
    CostoProyectoResponse,
    MaterialDeProyectoResponse,
    ValorBodegaResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(token: CurrentToken, session: DBSession):
    """KPIs rápidos: totales de activos, préstamos activos y stock bajo."""
    tid = token.tenant_id

    total_variantes = (await session.execute(
        sa.select(sa.func.count()).select_from(Variante).where(Variante.tenant_id == tid)
    )).scalar()

    active_loans = (await session.execute(
        sa.select(sa.func.count()).select_from(Loan)
        .where(Loan.tenant_id == tid)
        .where(Loan.fecha_devolucion_real.is_(None))
    )).scalar()

    # `stock_minimo = 0` desactiva la alerta: si no, todo el catálogo sin mínimo
    # configurado aparecería como quiebre permanente.
    low_stock = len(await VarianteRepository(session, tid).bajo_stock())

    return {
        "total_assets": total_variantes,
        "active_loans": active_loans,
        "low_stock": low_stock,
    }


@router.get("/assets-by-state")
async def assets_by_state(token: CurrentToken, session: DBSession):
    """Distribución de activos por estado para gráfico donut."""
    rows = (await session.execute(
        # Sólo los ejemplares tienen estado: una variante consumible no está
        # "Disponible" ni "En Terreno", su condición operativa es su stock.
        sa.select(AssetState.nombre, sa.func.count(Unidad.id).label("count"))
        .join(Unidad, Unidad.estado_id == AssetState.id)
        .where(Unidad.tenant_id == token.tenant_id)
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
        result[d] = 0.0
    for r in rows:
        # float y no int: hay consumibles que se miden (12,5 m) y truncar
        # los haría desaparecer del gráfico
        result[str(r.dia)] = float(r.cantidad or 0)

    return [{"dia": k, "cantidad": v} for k, v in result.items()]


@router.get("/low-stock-detail")
async def low_stock_detail(token: CurrentToken, session: DBSession):
    """Quiebres unificados: consumibles por su columna, herramientas por conteo.

    Incluye ejemplares: "quedan menos de 2 taladros disponibles" es una alerta tan
    válida como la de los tornillos, sólo que su stock se deriva del conteo.
    """
    repo = VarianteRepository(session, token.tenant_id)
    filas = []
    for variante, _total, disponibles in await repo.bajo_stock():
        familia = variante.producto.family
        efectivo = VarianteRepository.stock_efectivo(
            variante, familia.comportamiento, disponibles
        )
        ubic = variante.ubicacion
        filas.append({
            "id": variante.id,
            "uid_fisico": next((c.codigo for c in variante.codigos if c.es_principal), None),
            "nombre": f"{variante.producto.nombre} · {variante.nombre}",
            "stock_actual": float(efectivo),
            "stock_minimo": float(variante.stock_minimo),
            "unidad": variante.unidad,
            "family_nombre": familia.nombre,
            "family_color": familia.color,
            # Dónde reponer, para no tener que abrir la ficha
            "ubicacion_rack": ubic.rack if ubic else None,
            "ubicacion_nivel": ubic.nivel if ubic else None,
            "ubicacion_posicion": ubic.posicion if ubic else None,
        })
    # El de menor stock primero: es el que hay que reponer ya
    return sorted(filas, key=lambda x: x["stock_actual"])


@router.get("/valor-bodega", response_model=ValorBodegaResponse)
async def valor_bodega(token: CurrentToken, session: DBSession, limite: int = 10):
    """Capital inmovilizado en bodega, con el detalle de dónde se concentra.

    El total solo no decide nada: lo accionable es qué activos acumulan el valor
    y hace cuánto que no se mueven.
    """
    return await VarianteRepository(session, token.tenant_id).valor_bodega(
        limite_detalle=limite
    )


@router.get("/costo-materiales-por-proyecto", response_model=list[CostoProyectoResponse])
async def costo_materiales_por_proyecto(
    token: CurrentToken, session: DBSession, solo_activos: bool = True
):
    """Gasto en materiales acumulado por proyecto, mayor primero.

    Es costo de MATERIALES, no del proyecto: no incluye mano de obra ni uso de
    herramientas. La interfaz debe titularlo así para no sugerir una completitud
    que no tiene.
    """
    from app.repositories.inventory_log import InventoryLogRepository

    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.costo_materiales_por_proyecto(solo_activos=solo_activos)


@router.get(
    "/costo-materiales-por-proyecto/{project_id}/materiales",
    response_model=list[MaterialDeProyectoResponse],
)
async def materiales_de_proyecto(project_id: int, token: CurrentToken, session: DBSession):
    """En qué materiales se fue el gasto de una obra, con cantidades netas.

    El total responde cuánto; esto responde en qué, que es lo accionable: el mismo
    monto significa cosas distintas si se fue en un consumible barato que en uno caro.
    """
    from app.repositories.inventory_log import InventoryLogRepository

    repo = InventoryLogRepository(session, token.tenant_id)
    return await repo.materiales_de_proyecto(project_id)


@router.get("/overdue-loans")
async def overdue_loans(token: CurrentToken, session: DBSession):
    """Préstamos abiertos que superaron su plazo, con la precedencia:

    1. Entregado a cargo → nunca vence. Nadie le pidió que volviera.
    2. Con fecha pactada → manda esa fecha. El bodeguero sabía algo que el
       catálogo no sabe, y hasta ahora ese dato se guardaba sin usarse.
    3. Sin fecha → límite del catálogo (override de la variante o su familia).
    4. Sin fecha y sin límite → fuera del cálculo.

    Lo entregado a cargo se excluye en la consulta y no en el bucle: no tiene
    sentido traer filas para descartarlas.
    """
    from app.models.codigo import Codigo
    from app.models.producto import Producto

    Operario = sa.orm.aliased(User, name="operario")
    principal = (
        sa.select(Codigo.unidad_id, Codigo.codigo)
        .where(Codigo.tenant_id == token.tenant_id)
        .where(Codigo.es_principal.is_(True))
        .where(Codigo.unidad_id.isnot(None))
        .subquery()
    )

    rows = (await session.execute(
        sa.select(
            Loan.id.label("loan_id"),
            Loan.fecha_entrega,
            Loan.fecha_devolucion_prevista,
            Unidad.id.label("unidad_id"),
            principal.c.codigo.label("uid_fisico"),
            (Producto.nombre + " · " + Variante.nombre).label("asset_nombre"),
            Variante.dias_max_prestamo.label("variante_dias"),
            AssetFamily.dias_max_prestamo.label("family_dias"),
            AssetFamily.nombre.label("family_nombre"),
            AssetFamily.color.label("family_color"),
            Operario.nombre.label("user_nombre"),
        )
        .join(Unidad, Loan.unidad_id == Unidad.id)
        .join(Variante, Unidad.variante_id == Variante.id)
        .join(Producto, Variante.producto_id == Producto.id)
        .join(AssetFamily, Producto.family_id == AssetFamily.id)
        .join(Operario, Loan.user_id == Operario.id)
        .outerjoin(principal, principal.c.unidad_id == Unidad.id)
        .where(Loan.tenant_id == token.tenant_id)
        .where(Loan.fecha_devolucion_real.is_(None))
        .where(Loan.modalidad != MODALIDAD_A_CARGO)
        .where(
            sa.or_(
                Loan.fecha_devolucion_prevista.isnot(None),
                Variante.dias_max_prestamo.isnot(None),
                AssetFamily.dias_max_prestamo.isnot(None),
            )
        )
    )).all()

    now = datetime.now(timezone.utc)
    result = []
    for r in rows:
        entrega = r.fecha_entrega.replace(tzinfo=timezone.utc)
        dias_transcurridos = (now - entrega).days

        if r.fecha_devolucion_prevista is not None:
            prevista = r.fecha_devolucion_prevista.replace(tzinfo=timezone.utc)
            if now <= prevista:
                continue
            origen = "pactado"
            # Redondeo y no techo: el plazo se pacta en días enteros y se guarda
            # como instante, así que "5 días" vuelve con microsegundos de sobra y
            # un ceil lo reportaría como 6. El exceso se cuenta en días cumplidos,
            # con mínimo 1: algo vencido hace horas no puede mostrarse como "+0d".
            limite = round((prevista - entrega).total_seconds() / 86400)
            dias_excedido = max(1, (now - prevista).days)
        else:
            # Herencia: override de la variante → familia → sin límite
            limite = r.variante_dias if r.variante_dias is not None else r.family_dias
            if limite is None or dias_transcurridos <= limite:
                continue
            origen = "catalogo"
            dias_excedido = dias_transcurridos - limite

        result.append({
            "loan_id": r.loan_id,
            "asset_id": r.unidad_id,
            "uid_fisico": r.uid_fisico,
            "asset_nombre": r.asset_nombre,
            "family_nombre": r.family_nombre,
            "family_color": r.family_color,
            "user_nombre": r.user_nombre,
            "dias_transcurridos": dias_transcurridos,
            "dias_max": limite,
            "dias_excedido": dias_excedido,
            "origen_plazo": origen,
        })

    # Lo más atrasado primero: es el orden en que hay que salir a buscarlas.
    result.sort(key=lambda x: x["dias_excedido"], reverse=True)
    return result
