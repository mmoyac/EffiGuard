from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset
from app.repositories.base import BaseRepository


class AssetRepository(BaseRepository[Asset]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Asset, session, tenant_id)

    def _base_query(self):
        # Siempre carga children para evitar MissingGreenlet en serialización async
        return (
            super()._base_query().options(selectinload(Asset.children))
        )

    async def get_by_uid(self, uid_fisico: str) -> Asset | None:
        result = await self.session.execute(
            self._base_query().where(Asset.uid_fisico == uid_fisico)
        )
        return result.scalar_one_or_none()

    async def get_with_children(self, asset_id: int) -> Asset | None:
        result = await self.session.execute(
            self._base_query().where(Asset.id == asset_id)
        )
        return result.scalar_one_or_none()

    async def list_low_stock(self) -> list[Asset]:
        result = await self.session.execute(
            self._base_query()
            .where(Asset.tipo == "consumible")
            .where(Asset.stock_actual <= Asset.stock_minimo)
        )
        return list(result.scalars().all())
