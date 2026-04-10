from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan
from app.repositories.base import BaseRepository


class LoanRepository(BaseRepository[Loan]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Loan, session, tenant_id)

    async def get_active_by_asset(self, asset_id: int) -> Loan | None:
        """Préstamo activo (sin devolución real) para un activo."""
        result = await self.session.execute(
            self._base_query()
            .where(Loan.asset_id == asset_id)
            .where(Loan.fecha_devolucion_real.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Loan]:
        """Todos los préstamos activos del tenant."""
        result = await self.session.execute(
            self._base_query().where(Loan.fecha_devolucion_real.is_(None))
        )
        return list(result.scalars().all())

    async def list_by_user(self, user_id: int) -> list[Loan]:
        result = await self.session.execute(
            self._base_query().where(Loan.user_id == user_id)
        )
        return list(result.scalars().all())

    async def return_loan(self, loan: Loan) -> Loan:
        loan.fecha_devolucion_real = datetime.now(timezone.utc)
        await self.session.flush()
        return loan
