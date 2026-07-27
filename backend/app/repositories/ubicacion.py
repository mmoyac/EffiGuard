from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.ubicacion import Ubicacion
from app.repositories.base import BaseRepository


class UbicacionRepository(BaseRepository[Ubicacion]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Ubicacion, session, tenant_id)

    def _ordenada(self):
        return self._base_query().order_by(Ubicacion.rack, Ubicacion.nivel, Ubicacion.posicion)

    async def list_all(self) -> list[Ubicacion]:
        """Catálogo completo. Sin paginar: es un catálogo de bodega, no un histórico."""
        result = await self.session.execute(self._ordenada())
        return list(result.scalars().all())

    async def get_by_posicion(self, rack: str, nivel: str, posicion: str) -> Ubicacion | None:
        result = await self.session.execute(
            self._base_query()
            .where(Ubicacion.rack == rack)
            .where(Ubicacion.nivel == nivel)
            .where(Ubicacion.posicion == posicion)
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, rack: str, nivel: str, posicion: str) -> tuple[Ubicacion, bool]:
        """Devuelve (ubicacion, fue_creada). Lo usa la importación Excel."""
        existente = await self.get_by_posicion(rack, nivel, posicion)
        if existente:
            return existente, False
        return await self.create(rack=rack, nivel=nivel, posicion=posicion), True

    # ── Selectores en cascada ────────────────────────────────────────────────
    # Se derivan del catálogo en vez de mantenerse en tablas aparte: un 'nivel 5'
    # no existe con independencia de su rack.

    async def racks(self) -> list[str]:
        result = await self.session.execute(
            select(distinct(Ubicacion.rack))
            .where(Ubicacion.tenant_id == self.tenant_id)
            .order_by(Ubicacion.rack)
        )
        return list(result.scalars().all())

    async def niveles(self, rack: str) -> list[str]:
        result = await self.session.execute(
            select(distinct(Ubicacion.nivel))
            .where(Ubicacion.tenant_id == self.tenant_id)
            .where(Ubicacion.rack == rack)
            .order_by(Ubicacion.nivel)
        )
        return list(result.scalars().all())

    async def posiciones(self, rack: str, nivel: str) -> list[Ubicacion]:
        result = await self.session.execute(
            self._base_query()
            .where(Ubicacion.rack == rack)
            .where(Ubicacion.nivel == nivel)
            .order_by(Ubicacion.posicion)
        )
        return list(result.scalars().all())

    async def contar_assets(self, ubicacion_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Asset)
            .where(Asset.ubicacion_id == ubicacion_id)
            .where(Asset.tenant_id == self.tenant_id)
        )
        return result.scalar_one()
