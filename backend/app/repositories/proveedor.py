from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.codigo import Codigo
from app.models.proveedor import Proveedor
from app.repositories.base import BaseRepository


class ProveedorRepository(BaseRepository[Proveedor]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Proveedor, session, tenant_id)

    async def list_all(self) -> list[Proveedor]:
        """Catálogo completo, sin paginar: son unos pocos por tenant."""
        result = await self.session.execute(self._base_query().order_by(Proveedor.nombre))
        return list(result.scalars().all())

    async def get_by_nombre(self, nombre: str) -> Proveedor | None:
        result = await self.session.execute(
            self._base_query().where(func.lower(Proveedor.nombre) == nombre.strip().lower())
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, nombre: str) -> tuple[Proveedor, bool]:
        """Devuelve (proveedor, fue_creado). Lo usa la importación Excel.

        Se crea en vez de rechazar la fila con el mismo criterio que `ubicacion`:
        un proveedor es una etiqueta de dónde vino algo, no configuración con
        significado de negocio como la familia.
        """
        existente = await self.get_by_nombre(nombre)
        if existente:
            return existente, False
        return await self.create(nombre=nombre.strip()), True

    async def contar_codigos(self, proveedor_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Codigo)
            .where(Codigo.proveedor_id == proveedor_id)
            .where(Codigo.tenant_id == self.tenant_id)
        )
        return result.scalar_one()
