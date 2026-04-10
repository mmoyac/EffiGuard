from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_log import InventoryLog
from app.repositories.base import BaseRepository


class InventoryLogRepository(BaseRepository[InventoryLog]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(InventoryLog, session, tenant_id)

    async def list_by_asset(self, asset_id: int) -> list[InventoryLog]:
        result = await self.session.execute(
            self._base_query()
            .where(InventoryLog.asset_id == asset_id)
            .order_by(InventoryLog.fecha_hora.desc())
        )
        return list(result.scalars().all())
