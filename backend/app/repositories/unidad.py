from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.codigo import Codigo
from app.models.producto import Producto
from app.models.unidad import Unidad
from app.models.variante import Variante
from app.repositories.base import BaseRepository

ESTADO_DISPONIBLE = 1


class UnidadRepository(BaseRepository[Unidad]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Unidad, session, tenant_id)

    def _con_relaciones(self):
        return self._base_query().options(
            selectinload(Unidad.codigos).selectinload(Codigo.proveedor),
            selectinload(Unidad.ubicacion),
            # La familia viaja siempre: el comportamiento (prestable/consumible)
            # se hereda de ahí y lo consulta cada operación.
            selectinload(Unidad.variante)
            .selectinload(Variante.producto)
            .selectinload(Producto.family),
        )

    async def list_de_variante(self, variante_id: int) -> list[Unidad]:
        result = await self.session.execute(
            self._con_relaciones().where(Unidad.variante_id == variante_id).order_by(Unidad.id)
        )
        return list(result.scalars().all())

    async def get_con_relaciones(self, unidad_id: int) -> Unidad | None:
        result = await self.session.execute(
            self._con_relaciones().where(Unidad.id == unidad_id)
        )
        return result.scalar_one_or_none()

    async def get_con_hijas(self, unidad_id: int) -> Unidad | None:
        """Un kit se presta y se devuelve entero, así que sus piezas se cargan juntas."""
        result = await self.session.execute(
            self._base_query()
            .where(Unidad.id == unidad_id)
            .options(
                selectinload(Unidad.codigos),
                selectinload(Unidad.variante)
                .selectinload(Variante.producto)
                .selectinload(Producto.family),
                selectinload(Unidad.children).selectinload(Unidad.codigos),
            )
        )
        return result.scalar_one_or_none()

    async def disponibles_de_variante(self, variante_id: int) -> list[Unidad]:
        """Ejemplares que se pueden prestar ahora, los más antiguos primero.

        Rotar por antigüedad reparte el desgaste: sin orden, el primero de la lista
        se presta siempre y se rompe antes que el resto.
        """
        result = await self.session.execute(
            self._con_relaciones()
            .where(Unidad.variante_id == variante_id)
            .where(Unidad.estado_id == ESTADO_DISPONIBLE)
            .order_by(Unidad.id)
        )
        return list(result.scalars().all())

    async def codigos_usados(self) -> set[str]:
        """Todos los códigos del tenant, para que el UID autogenerado no choque.

        Se consulta la tabla completa y no sólo los de unidades porque la unicidad
        es por tenant sobre todo lo escaneable: un EFG-XXXXXXXX no puede coincidir
        con el código de una variante tampoco.
        """
        result = await self.session.execute(
            select(Codigo.codigo).where(Codigo.tenant_id == self.tenant_id)
        )
        return set(result.scalars().all())

    async def contar_por_variante(self, variante_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Unidad)
            .where(Unidad.variante_id == variante_id)
            .where(Unidad.tenant_id == self.tenant_id)
        )
        return result.scalar_one()
