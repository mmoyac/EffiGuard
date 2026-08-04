from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset_family import AssetFamily
from app.models.producto import Producto
from app.models.variante import Variante
from app.repositories.base import BaseRepository


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Producto, session, tenant_id)

    def _con_relaciones(self):
        return self._base_query().options(
            selectinload(Producto.family),
            selectinload(Producto.brand),
        )

    async def listar(
        self,
        comportamiento: str | None = None,
        brand_id: int | None = None,
        buscar: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Producto]:
        query = self._con_relaciones()
        if comportamiento:
            query = query.join(AssetFamily, Producto.family_id == AssetFamily.id).where(
                AssetFamily.comportamiento == comportamiento
            )
        if brand_id:
            query = query.where(Producto.brand_id == brand_id)
        if buscar:
            query = query.where(Producto.nombre.ilike(f"%{buscar.strip()}%"))
        query = query.order_by(Producto.nombre).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_con_relaciones(self, producto_id: int) -> Producto | None:
        result = await self.session.execute(
            self._con_relaciones().where(Producto.id == producto_id)
        )
        return result.scalar_one_or_none()

    async def get_por_nombre(self, nombre: str) -> Producto | None:
        """Upsert de la importación: repetir el nombre agrupa, no duplica."""
        result = await self.session.execute(
            self._con_relaciones().where(func.lower(Producto.nombre) == nombre.strip().lower())
        )
        return result.scalar_one_or_none()

    async def contar_variantes(self, producto_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Variante)
            .where(Variante.producto_id == producto_id)
            .where(Variante.tenant_id == self.tenant_id)
        )
        return result.scalar_one()

    async def contar_por_familia(self, family_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Producto)
            .where(Producto.family_id == family_id)
            .where(Producto.tenant_id == self.tenant_id)
        )
        return result.scalar_one()
