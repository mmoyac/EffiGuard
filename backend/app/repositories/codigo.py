from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.codigo import Codigo
from app.repositories.base import BaseRepository


class CodigoRepository(BaseRepository[Codigo]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Codigo, session, tenant_id)

    async def get_by_codigo(self, codigo: str) -> Codigo | None:
        """Resolución del escaneo: una sola consulta, sin regla de precedencia.

        Que variantes y unidades compartan tabla es justamente lo que permite esto:
        con dos tablas habría que buscar en una, después en la otra, y decidir cuál
        gana ante un choque que la base ya no podría impedir.
        """
        result = await self.session.execute(
            self._base_query()
            .where(Codigo.codigo == codigo.strip().upper())
            .options(selectinload(Codigo.proveedor))
        )
        return result.scalar_one_or_none()

    async def existe(self, codigo: str) -> bool:
        return await self.get_by_codigo(codigo) is not None

    async def list_de_variante(self, variante_id: int) -> list[Codigo]:
        result = await self.session.execute(
            self._base_query()
            .where(Codigo.variante_id == variante_id)
            .order_by(Codigo.es_principal.desc(), Codigo.id)
            .options(selectinload(Codigo.proveedor))
        )
        return list(result.scalars().all())

    async def list_de_unidad(self, unidad_id: int) -> list[Codigo]:
        result = await self.session.execute(
            self._base_query()
            .where(Codigo.unidad_id == unidad_id)
            .order_by(Codigo.es_principal.desc(), Codigo.id)
            .options(selectinload(Codigo.proveedor))
        )
        return list(result.scalars().all())

    async def proveedores_de_variante(self, variante_id: int) -> list[int]:
        """Los proveedores que esa variante ya conoce, por sus propios códigos.

        Es lo que el formulario de compra ofrece como selección rápida cuando no
        se escaneó ningún código.
        """
        result = await self.session.execute(
            select(Codigo.proveedor_id)
            .where(Codigo.tenant_id == self.tenant_id)
            .where(Codigo.variante_id == variante_id)
            .where(Codigo.proveedor_id.is_not(None))
            .distinct()
        )
        return list(result.scalars().all())
