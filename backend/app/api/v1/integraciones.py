"""
Consulta de disponibilidad para agentes externos (n8n).

Conserva la ruta `/assets/query` a propósito aunque el catálogo viejo ya no
exista: cambiarla obligaría a reconfigurar el workflow del cliente por un motivo
puramente interno.
"""
from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.dependencies import ApiKeyTenant, DBSession
from app.models.asset_family import AssetFamily
from app.models.codigo import Codigo
from app.models.loan import Loan
from app.models.producto import Producto
from app.models.unidad import Unidad
from app.models.user import User
from app.models.variante import Variante
from app.schemas.inventory import VarianteQueryResult

router = APIRouter(prefix="/assets", tags=["Integraciones"])

ESTADO_DISPONIBLE = 1


@router.get("/query", response_model=list[VarianteQueryResult])
async def query_variantes(q: str, tenant_id: ApiKeyTenant, session: DBSession):
    """Busca por nombre de producto, de variante o por código exacto.

    Un agente que responde "¿queda taladro?" necesita el nombre; uno que recibe el
    número de parte de un proveedor necesita el código. Las dos entradas llegan al
    mismo lugar.
    """
    patron = f"%{q.strip()}%"
    codigo_exacto = q.strip().upper()

    filas = (
        await session.execute(
            select(Variante)
            .join(Producto, Variante.producto_id == Producto.id)
            .join(AssetFamily, Producto.family_id == AssetFamily.id)
            .outerjoin(Codigo, Codigo.variante_id == Variante.id)
            .where(Variante.tenant_id == tenant_id)
            .where(
                Producto.nombre.ilike(patron)
                | Variante.nombre.ilike(patron)
                | (Codigo.codigo == codigo_exacto)
            )
            .options(
                selectinload(Variante.producto).selectinload(Producto.family),
                selectinload(Variante.ubicacion),
            )
            .distinct()
            .limit(25)
        )
    ).scalars().all()

    salida: list[VarianteQueryResult] = []
    for v in filas:
        familia = v.producto.family
        prestable = familia.comportamiento == "prestable"
        ubic = v.ubicacion

        base = dict(
            producto=v.producto.nombre,
            variante=v.nombre,
            tipo=familia.comportamiento,
            unidad=v.unidad,
            ubicacion_rack=ubic.rack if ubic else None,
            ubicacion_nivel=ubic.nivel if ubic else None,
            ubicacion_posicion=ubic.posicion if ubic else None,
        )

        if prestable:
            conteos = (
                await session.execute(
                    select(
                        func.count().label("total"),
                        func.count().filter(Unidad.estado_id == ESTADO_DISPONIBLE).label("disp"),
                    )
                    .select_from(Unidad)
                    .where(Unidad.tenant_id == tenant_id)
                    .where(Unidad.variante_id == v.id)
                )
            ).one()
            prestadas = (
                await session.execute(
                    select(User.nombre, Loan.fecha_entrega)
                    .join(Unidad, Loan.unidad_id == Unidad.id)
                    .join(User, Loan.user_id == User.id)
                    .where(Loan.tenant_id == tenant_id)
                    .where(Unidad.variante_id == v.id)
                    .where(Loan.fecha_devolucion_real.is_(None))
                    # Sólo unidades raíz: al prestar un kit se crea un préstamo por
                    # pieza, y listarlas todas repetiría al mismo operario N veces
                    # por una sola entrega.
                    .where(Unidad.parent_unidad_id.is_(None))
                )
            ).all()
            salida.append(
                VarianteQueryResult(
                    **base,
                    unidades_total=conteos.total,
                    unidades_disponibles=conteos.disp,
                    prestadas_a=[
                        f"{n} desde {f.strftime('%d/%m/%Y %H:%M')}" for n, f in prestadas
                    ],
                )
            )
        else:
            salida.append(
                VarianteQueryResult(
                    **base,
                    stock_actual=v.stock_actual,
                    stock_minimo=v.stock_minimo,
                    bajo_stock=bool(
                        v.stock_minimo and v.stock_minimo > 0 and v.stock_actual <= v.stock_minimo
                    ),
                )
            )
    return salida
