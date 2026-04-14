from fastapi import APIRouter, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.loan import LoanRepository
from app.schemas.asset import ConsumableWithdraw
from app.schemas.loan import ActiveLoanResponse, LoanCreate, LoanResponse, LoanReturn
from app.schemas.inventory import InventoryLogResponse
from app.services import asset as asset_service
from app.services import loan as loan_service

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.get("", response_model=list[ActiveLoanResponse])
async def list_loans(token: CurrentToken, session: DBSession, active_only: bool = False):
    from sqlalchemy import select
    from sqlalchemy.orm import aliased
    from app.models.loan import Loan
    from app.models.user import User
    from app.models.project import Project
    from app.models.asset import Asset

    operario = aliased(User, name="operario")
    bodeguero = aliased(User, name="bodeguero")

    query = (
        select(
            Loan,
            operario.nombre.label("user_nombre"),
            operario.rut.label("user_rut"),
            bodeguero.nombre.label("bodeguero_nombre"),
            Project.nombre.label("proyecto_nombre"),
            Asset.uid_fisico.label("asset_uid_fisico"),
            Asset.nombre.label("asset_nombre"),
        )
        .join(operario, Loan.user_id == operario.id)
        .join(bodeguero, Loan.bodeguero_id == bodeguero.id)
        .outerjoin(Project, Loan.project_id == Project.id)
        .join(Asset, Loan.asset_id == Asset.id)
        .where(Loan.tenant_id == token.tenant_id)
        .order_by(Loan.fecha_entrega.desc())
    )
    if active_only:
        query = query.where(Loan.fecha_devolucion_real.is_(None))

    result = await session.execute(query)
    return [
        ActiveLoanResponse(
            **{c.key: getattr(loan, c.key) for c in Loan.__table__.columns},
            user_nombre=user_nombre,
            user_rut=user_rut,
            bodeguero_nombre=bodeguero_nombre,
            proyecto_nombre=proyecto_nombre,
            asset_uid_fisico=asset_uid_fisico,
            asset_nombre=asset_nombre,
        )
        for loan, user_nombre, user_rut, bodeguero_nombre, proyecto_nombre, asset_uid_fisico, asset_nombre in result.all()
    ]


@router.get("/my", response_model=list[ActiveLoanResponse])
async def my_loans(token: CurrentToken, session: DBSession):
    """Préstamos del operario autenticado, enriquecidos con nombres y proyecto."""
    from sqlalchemy import select
    from sqlalchemy.orm import aliased
    from app.models.loan import Loan
    from app.models.user import User
    from app.models.project import Project
    from app.models.asset import Asset

    operario = aliased(User, name="operario")
    bodeguero = aliased(User, name="bodeguero")

    result = await session.execute(
        select(
            Loan,
            operario.nombre.label("user_nombre"),
            operario.rut.label("user_rut"),
            bodeguero.nombre.label("bodeguero_nombre"),
            Project.nombre.label("proyecto_nombre"),
            Asset.uid_fisico.label("asset_uid_fisico"),
            Asset.nombre.label("asset_nombre"),
        )
        .join(operario, Loan.user_id == operario.id)
        .join(bodeguero, Loan.bodeguero_id == bodeguero.id)
        .outerjoin(Project, Loan.project_id == Project.id)
        .join(Asset, Loan.asset_id == Asset.id)
        .where(Loan.tenant_id == token.tenant_id)
        .where(Loan.user_id == token.user_id)
        .where(Loan.fecha_devolucion_real.is_(None))
        .order_by(Loan.fecha_entrega.desc())
    )

    rows = result.all()
    return [
        ActiveLoanResponse(
            **{c.key: getattr(loan, c.key) for c in Loan.__table__.columns},
            user_nombre=user_nombre,
            user_rut=user_rut,
            bodeguero_nombre=bodeguero_nombre,
            proyecto_nombre=proyecto_nombre,
            asset_uid_fisico=asset_uid_fisico,
            asset_nombre=asset_nombre,
        )
        for loan, user_nombre, user_rut, bodeguero_nombre, proyecto_nombre, asset_uid_fisico, asset_nombre in rows
    ]


@router.post("", response_model=list[LoanResponse], status_code=status.HTTP_201_CREATED)
async def create_loan(data: LoanCreate, token: CurrentToken, session: DBSession):
    """Crea préstamo de herramienta o kit completo (padre + hijos en un escaneo)."""
    return await asset_service.create_loan(data, session, token.tenant_id, token.user_id)


@router.post("/consumables/withdraw", response_model=InventoryLogResponse, status_code=status.HTTP_201_CREATED)
async def withdraw_consumable(data: ConsumableWithdraw, token: CurrentToken, session: DBSession):
    """Retira consumibles: descuenta stock y genera log sin crear préstamo."""
    return await asset_service.withdraw_consumable(data, session, token.tenant_id, token.user_id)


@router.get("/active/asset/{asset_id}", response_model=ActiveLoanResponse | None)
async def get_active_loan_by_asset(asset_id: int, token: CurrentToken, session: DBSession):
    """Retorna el préstamo activo enriquecido con nombre del operario, o null."""
    from sqlalchemy import select
    from sqlalchemy.orm import aliased
    from app.models.loan import Loan
    from app.models.user import User
    from app.models.project import Project
    from app.models.asset import Asset

    operario = aliased(User, name="operario")
    bodeguero = aliased(User, name="bodeguero")

    result = await session.execute(
        select(
            Loan,
            operario.nombre.label("user_nombre"),
            operario.rut.label("user_rut"),
            bodeguero.nombre.label("bodeguero_nombre"),
            Project.nombre.label("proyecto_nombre"),
            Asset.uid_fisico.label("asset_uid_fisico"),
            Asset.nombre.label("asset_nombre"),
        )
        .join(operario, Loan.user_id == operario.id)
        .join(bodeguero, Loan.bodeguero_id == bodeguero.id)
        .outerjoin(Project, Loan.project_id == Project.id)
        .join(Asset, Loan.asset_id == Asset.id)
        .where(Loan.tenant_id == token.tenant_id)
        .where(Loan.asset_id == asset_id)
        .where(Loan.fecha_devolucion_real.is_(None))
    )
    row = result.first()
    if not row:
        return None

    loan, user_nombre, user_rut, bodeguero_nombre, proyecto_nombre, asset_uid_fisico, asset_nombre = row
    return ActiveLoanResponse(
        **{c.key: getattr(loan, c.key) for c in Loan.__table__.columns},
        user_nombre=user_nombre,
        user_rut=user_rut,
        bodeguero_nombre=bodeguero_nombre,
        proyecto_nombre=proyecto_nombre,
        asset_uid_fisico=asset_uid_fisico,
        asset_nombre=asset_nombre,
    )


@router.post("/{loan_id}/return", response_model=LoanResponse)
async def return_loan(loan_id: int, data: LoanReturn, token: CurrentToken, session: DBSession):
    return await loan_service.return_loan(loan_id, session, token.tenant_id, token.user_id, data.observaciones)
