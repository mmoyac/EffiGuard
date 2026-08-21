from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.codigo import Codigo
from app.models.producto import Producto
from app.models.ubicacion import Ubicacion
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
                # El plazo del kit lo acota la pieza de techo más bajo, así que
                # cada hija necesita su variante y su familia a mano.
                selectinload(Unidad.children)
                .selectinload(Unidad.variante)
                .selectinload(Variante.producto)
                .selectinload(Producto.family),
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

    async def ubicaciones_disponibles(
        self, variante_ids: list[int]
    ) -> dict[int, list[tuple[str | None, str | None, str | None, int]]]:
        """Dónde están, y cuántos hay en cada posición, los ejemplares que se pueden prestar.

        Una sola query agregada para toda la página de resultados: una por fila
        convertiría cada búsqueda de bodega en cincuenta viajes a la base.

        La precedencia unidad → variante se resuelve con el `coalesce` dentro del
        join, así que una unidad sin ubicación propia se cuenta en la repisa de su
        variante en vez de aparecer sin ubicar.
        """
        if not variante_ids:
            return {}

        ubicacion_efectiva = func.coalesce(Unidad.ubicacion_id, Variante.ubicacion_id)
        result = await self.session.execute(
            select(
                Unidad.variante_id,
                Ubicacion.rack,
                Ubicacion.nivel,
                Ubicacion.posicion,
                func.count().label("ejemplares"),
            )
            .join(Variante, Unidad.variante_id == Variante.id)
            .outerjoin(Ubicacion, Ubicacion.id == ubicacion_efectiva)
            .where(Unidad.tenant_id == self.tenant_id)
            .where(Unidad.variante_id.in_(variante_ids))
            .where(Unidad.estado_id == ESTADO_DISPONIBLE)
            .group_by(Unidad.variante_id, Ubicacion.rack, Ubicacion.nivel, Ubicacion.posicion)
            .order_by(Ubicacion.rack, Ubicacion.nivel, Ubicacion.posicion)
        )

        por_variante: dict[int, list[tuple[str | None, str | None, str | None, int]]] = {}
        for variante_id, rack, nivel, posicion, ejemplares in result.all():
            por_variante.setdefault(variante_id, []).append((rack, nivel, posicion, ejemplares))
        return por_variante

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
