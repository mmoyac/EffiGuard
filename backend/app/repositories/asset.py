from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset
from app.models.asset_family import AssetFamily
from app.models.ubicacion import Ubicacion
from app.repositories.base import BaseRepository


class AssetRepository(BaseRepository[Asset]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Asset, session, tenant_id)

    def _base_query(self):
        # Carga family, ubicacion, children y sus children (2 niveles) para evitar
        # MissingGreenlet en la serialización async
        return (
            super()._base_query().options(
                selectinload(Asset.family),
                selectinload(Asset.ubicacion),
                selectinload(Asset.children).selectinload(Asset.children),
                selectinload(Asset.children).selectinload(Asset.family),
                selectinload(Asset.children).selectinload(Asset.ubicacion),
            )
        )

    async def get_by_uid(self, uid_fisico: str) -> Asset | None:
        result = await self.session.execute(
            self._base_query().where(Asset.uid_fisico == uid_fisico)
        )
        return result.scalar_one_or_none()

    async def get_by_codigo_fabricante(self, codigo: str) -> list[Asset]:
        """Todas las unidades del producto. Devuelve lista porque el código de
        fábrica identifica el producto, no la unidad: tres atornilladores iguales
        comparten el mismo código."""
        result = await self.session.execute(
            self._base_query().where(Asset.codigo_fabricante == codigo.strip().upper())
        )
        return list(result.scalars().all())

    async def uids_existentes(self) -> set[str]:
        """UIDs ya usados en el tenant, para generar nuevos sin colisionar."""
        result = await self.session.execute(
            select(Asset.uid_fisico).where(Asset.tenant_id == self.tenant_id)
        )
        return {uid for (uid,) in result.all()}

    async def get_with_children(self, asset_id: int) -> Asset | None:
        result = await self.session.execute(
            self._base_query().where(Asset.id == asset_id)
        )
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        comportamiento: str | None = None,
        ubicacion_rack: str | None = None,
        ubicacion_id: int | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Asset]:
        q = self._base_query()
        if comportamiento:
            q = q.join(AssetFamily, Asset.family_id == AssetFamily.id).where(AssetFamily.comportamiento == comportamiento)
        if ubicacion_id is not None:
            q = q.where(Asset.ubicacion_id == ubicacion_id)
        if ubicacion_rack:
            # Todo lo guardado en un rack, sin importar nivel ni posición
            q = q.join(Ubicacion, Asset.ubicacion_id == Ubicacion.id).where(
                Ubicacion.rack == ubicacion_rack.strip().upper()
            )
        q = q.offset(offset).limit(limit)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def list_low_stock(self) -> list[Asset]:
        result = await self.session.execute(
            self._base_query()
            .join(AssetFamily, Asset.family_id == AssetFamily.id)
            .where(AssetFamily.comportamiento == "consumible")
            .where(Asset.stock_actual <= Asset.stock_minimo)
        )
        return list(result.scalars().all())
