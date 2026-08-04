"""
Préstamos de ejemplares.

Se presta una unidad, no un modelo. El endpoint de consumibles vive en
`/variantes/{id}/withdraw`: un tornillo no se devuelve, así que no genera préstamo.
"""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import aliased

from app.core.dependencies import CurrentToken, DBSession
from app.models.loan import Loan
from app.models.producto import Producto
from app.models.project import Project
from app.models.unidad import Unidad
from app.models.user import User
from app.models.variante import Variante
from app.repositories.loan import LoanRepository
from app.repositories.unidad import UnidadRepository
from app.schemas.loan import ActiveLoanResponse, LoanCreate, LoanResponse, LoanReturn
from app.services import prestamo as prestamo_service

router = APIRouter(prefix="/loans", tags=["Loans"])

Operario = aliased(User, name="operario")
Bodeguero = aliased(User, name="bodeguero")


def _query_enriquecida(tenant_id: int):
    """El préstamo se lee siempre con quién, qué y de qué obra.

    El código principal de la unidad hace de identificador visible: es lo que está
    pegado en la herramienta y lo que el bodeguero va a buscar.
    """
    principal = (
        select(Unidad.id.label("unidad_id"))
        .where(Unidad.tenant_id == tenant_id)
        .subquery()
    )
    return (
        select(
            Loan,
            Operario.nombre.label("user_nombre"),
            Operario.rut.label("user_rut"),
            Bodeguero.nombre.label("bodeguero_nombre"),
            Project.nombre.label("proyecto_nombre"),
            (Producto.nombre + " · " + Variante.nombre).label("asset_nombre"),
        )
        .join(Operario, Loan.user_id == Operario.id)
        .join(Bodeguero, Loan.bodeguero_id == Bodeguero.id)
        .outerjoin(Project, Loan.project_id == Project.id)
        .join(Unidad, Loan.unidad_id == Unidad.id)
        .join(Variante, Unidad.variante_id == Variante.id)
        .join(Producto, Variante.producto_id == Producto.id)
        .where(Loan.tenant_id == tenant_id)
        .order_by(Loan.fecha_entrega.desc())
    ), principal


async def _codigos_principales(session, tenant_id: int, unidad_ids: list[int]) -> dict[int, str]:
    """Un map unidad → código principal, en una consulta en vez de N."""
    from app.models.codigo import Codigo

    if not unidad_ids:
        return {}
    rows = (
        await session.execute(
            select(Codigo.unidad_id, Codigo.codigo)
            .where(Codigo.tenant_id == tenant_id)
            .where(Codigo.unidad_id.in_(unidad_ids))
            .where(Codigo.es_principal.is_(True))
        )
    ).all()
    return {r[0]: r[1] for r in rows}


async def _a_respuesta(session, tenant_id: int, filas) -> list[ActiveLoanResponse]:
    codigos = await _codigos_principales(
        session, tenant_id, [f[0].unidad_id for f in filas]
    )
    return [
        ActiveLoanResponse(
            **{c.key: getattr(loan, c.key) for c in Loan.__table__.columns},
            user_nombre=user_nombre,
            user_rut=user_rut,
            bodeguero_nombre=bodeguero_nombre,
            proyecto_nombre=proyecto_nombre,
            asset_nombre=asset_nombre,
            asset_uid_fisico=codigos.get(loan.unidad_id),
        )
        for loan, user_nombre, user_rut, bodeguero_nombre, proyecto_nombre, asset_nombre in filas
    ]


@router.get("", response_model=list[ActiveLoanResponse])
async def list_loans(token: CurrentToken, session: DBSession, active_only: bool = False):
    query, _ = _query_enriquecida(token.tenant_id)
    if active_only:
        query = query.where(Loan.fecha_devolucion_real.is_(None))
    filas = (await session.execute(query)).all()
    return await _a_respuesta(session, token.tenant_id, filas)


@router.get("/my", response_model=list[ActiveLoanResponse])
async def my_loans(token: CurrentToken, session: DBSession):
    """Préstamos abiertos del operario autenticado."""
    query, _ = _query_enriquecida(token.tenant_id)
    query = query.where(Loan.user_id == token.user_id).where(
        Loan.fecha_devolucion_real.is_(None)
    )
    filas = (await session.execute(query)).all()
    return await _a_respuesta(session, token.tenant_id, filas)


@router.get("/active/unidad/{unidad_id}", response_model=ActiveLoanResponse | None)
async def get_active_loan_by_unidad(unidad_id: int, token: CurrentToken, session: DBSession):
    """Préstamo abierto de un ejemplar, o `null` si está en bodega."""
    query, _ = _query_enriquecida(token.tenant_id)
    query = query.where(Loan.unidad_id == unidad_id).where(
        Loan.fecha_devolucion_real.is_(None)
    )
    filas = (await session.execute(query)).all()
    respuestas = await _a_respuesta(session, token.tenant_id, filas)
    return respuestas[0] if respuestas else None


@router.get("/disponibles/{variante_id}", response_model=list[dict])
async def unidades_disponibles(variante_id: int, token: CurrentToken, session: DBSession):
    """Ejemplares que se pueden prestar ahora, los más antiguos primero.

    Es lo que la interfaz ofrece cuando el escaneo resuelve a la variante y no a un
    ejemplar concreto: "quedan 3 de 7, elige cuál".
    """
    unidades = await UnidadRepository(session, token.tenant_id).disponibles_de_variante(
        variante_id
    )
    return [
        {
            "id": u.id,
            "codigo_principal": next(
                (c.codigo for c in u.codigos if c.es_principal), None
            ),
            "ubicacion": (
                f"{u.ubicacion.rack}/{u.ubicacion.nivel}/{u.ubicacion.posicion}"
                if u.ubicacion
                else None
            ),
        }
        for u in unidades
    ]


@router.post("", response_model=list[LoanResponse], status_code=status.HTTP_201_CREATED)
async def create_loan(data: LoanCreate, token: CurrentToken, session: DBSession):
    """Presta un ejemplar, o el kit completo si tiene piezas hijas."""
    prestamos = await prestamo_service.crear_prestamo(
        data.unidad_id,
        data.user_id,
        session,
        token.tenant_id,
        token.user_id,
        project_id=data.project_id,
        fecha_devolucion_prevista=data.fecha_devolucion_prevista,
    )
    await session.commit()
    return prestamos


@router.post("/{loan_id}/return", response_model=list[LoanResponse])
async def return_loan(loan_id: int, data: LoanReturn, token: CurrentToken, session: DBSession):
    """Cierra el préstamo. Con `send_to_repair` la herramienta queda En Reparación.

    Si el ejemplar es kit padre, se cierran también los préstamos de sus piezas.
    """
    cerrados = await prestamo_service.devolver_prestamo(
        loan_id,
        session,
        token.tenant_id,
        token.user_id,
        data.returning_user_id,
        observaciones=data.observaciones,
        send_to_repair=data.send_to_repair,
    )
    await session.commit()
    return cerrados


@router.get("/kit/{unidad_id}", response_model=list[dict])
async def piezas_del_kit(unidad_id: int, token: CurrentToken, session: DBSession):
    """Piezas de un kit, para mostrar qué se va a prestar antes de confirmarlo."""
    unidad = await UnidadRepository(session, token.tenant_id).get_con_hijas(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    return [
        {
            "id": h.id,
            "codigo_principal": next((c.codigo for c in h.codigos if c.es_principal), None),
            "estado_id": h.estado_id,
        }
        for h in unidad.children
    ]
