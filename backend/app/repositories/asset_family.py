from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_family import AssetFamily
from app.repositories.base import BaseRepository


class AssetFamilyRepository(BaseRepository[AssetFamily]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(AssetFamily, session, tenant_id)
