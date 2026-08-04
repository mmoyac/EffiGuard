from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.loan import Loan
from app.models.unidad import Unidad
from app.models.variante import Variante
from app.repositories.base import BaseRepository


class LoanRepository(BaseRepository[Loan]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Loan, session, tenant_id)

    def _con_relaciones(self):
        """El préstamo se muestra siempre con qué herramienta es y qué código tiene:
        "Bosch GWS-850 · QR-00417" identifica; "préstamo #12" no."""
        return self._base_query().options(
            selectinload(Loan.unidad)
            .selectinload(Unidad.variante)
            .selectinload(Variante.producto),
            selectinload(Loan.unidad).selectinload(Unidad.codigos),
        )

    async def get_active_by_unidad(self, unidad_id: int) -> Loan | None:
        """Préstamo abierto de un ejemplar. Un ejemplar tiene a lo más uno."""
        result = await self.session.execute(
            self._base_query()
            .where(Loan.unidad_id == unidad_id)
            .where(Loan.fecha_devolucion_real.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Loan]:
        result = await self.session.execute(
            self._con_relaciones()
            .where(Loan.fecha_devolucion_real.is_(None))
            .order_by(Loan.fecha_entrega.desc())
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[Loan]:
        result = await self.session.execute(
            self._con_relaciones().order_by(Loan.fecha_entrega.desc())
        )
        return list(result.scalars().all())

    async def list_by_user(self, user_id: int, solo_abiertos: bool = True) -> list[Loan]:
        query = self._con_relaciones().where(Loan.user_id == user_id)
        if solo_abiertos:
            query = query.where(Loan.fecha_devolucion_real.is_(None))
        result = await self.session.execute(query.order_by(Loan.fecha_entrega.desc()))
        return list(result.scalars().all())

    async def return_loan(self, loan: Loan) -> Loan:
        loan.fecha_devolucion_real = datetime.now(timezone.utc)
        await self.session.flush()
        return loan
