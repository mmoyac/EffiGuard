from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(User, session, tenant_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            self._base_query().where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_credential_uid(self, uid: str) -> User | None:
        result = await self.session.execute(
            self._base_query().where(User.uid_credencial == uid)
        )
        return result.scalar_one_or_none()
