from typing import Any, Generic, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """
    Repositorio base con aislamiento multi-tenant automático.
    Toda query filtra por tenant_id — nunca se exponen datos cross-tenant.
    """

    def __init__(self, model: type[ModelT], session: AsyncSession, tenant_id: int):
        self.model = model
        self.session = session
        self.tenant_id = tenant_id

    def _base_query(self):
        return select(self.model).where(self.model.tenant_id == self.tenant_id)

    async def get(self, id: int) -> ModelT | None:
        result = await self.session.execute(
            self._base_query().where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def list(self, offset: int = 0, limit: int = 50) -> list[ModelT]:
        result = await self.session.execute(
            self._base_query().offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    async def count(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(self.model).where(self.model.tenant_id == self.tenant_id)
        )
        return result.scalar_one()

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(tenant_id=self.tenant_id, **kwargs)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def update(self, obj: ModelT, **kwargs: Any) -> ModelT:
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()
