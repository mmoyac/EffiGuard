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

    async def portador_de_credencial(self, uid: str, excluir_id: int | None = None) -> User | None:
        """Quién tiene ya esa credencial en el tenant, si es que alguien.

        Se compara por identidad y no por valor: el formulario de edición reenvía
        la credencial que el usuario ya tenía cada vez que se guarda cualquier
        otro campo, así que sin `excluir_id` el mantenedor quedaría inutilizable.
        """
        q = self._base_query().where(User.uid_credencial == uid)
        if excluir_id is not None:
            q = q.where(User.id != excluir_id)
        result = await self.session.execute(q)
        return result.scalar_one_or_none()

    async def list_by_role(self, role_id: int, offset: int = 0, limit: int = 50) -> list[User]:
        """Usuarios activos de un rol. Lo usan los selectores de operario.

        Filtra los inactivos: ofrecer a alguien que ya no trabaja en la empresa es
        entregarle material a nombre de un fantasma.
        """
        result = await self.session.execute(
            self._base_query()
            .where(User.role_id == role_id)
            .where(User.is_active.is_(True))
            .order_by(User.nombre)
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())
