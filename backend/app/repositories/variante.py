from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Select, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset_family import AssetFamily
from app.models.codigo import Codigo
from app.models.producto import Producto
from app.models.unidad import Unidad
from app.models.variante import Variante
from app.repositories.base import BaseRepository

ESTADO_DISPONIBLE = 1
ESTADO_ROBADO = 4


class VarianteRepository(BaseRepository[Variante]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(Variante, session, tenant_id)

    # ── Conteo de ejemplares ─────────────────────────────────────────────────

    def _conteos_sq(self):
        """Total, disponibles y en parque por variante, en una subconsulta.

        El stock de una variante prestable NO se almacena: es este conteo. Guardarlo
        obligaría a sincronizarlo en cada préstamo, devolución, reparación, pérdida
        y alta de unidad — cinco caminos para que mienta sobre datos que tiene al lado.

        `disponibles` y `en_parque` responden preguntas distintas: qué puedo prestar
        hoy, y qué herramientas tengo. Una prestada no se puede prestar pero sigue
        siendo mía; una robada no es ninguna de las dos.
        """
        return (
            select(
                Unidad.variante_id.label("variante_id"),
                func.count().label("total"),
                func.count(case((Unidad.estado_id == ESTADO_DISPONIBLE, 1))).label("disponibles"),
                func.count(case((Unidad.estado_id != ESTADO_ROBADO, 1))).label("en_parque"),
            )
            .where(Unidad.tenant_id == self.tenant_id)
            .group_by(Unidad.variante_id)
            .subquery()
        )

    def _query_con_conteos(self) -> tuple[Select, object]:
        sq = self._conteos_sq()
        query = (
            select(
                Variante,
                func.coalesce(sq.c.total, 0).label("unidades_total"),
                func.coalesce(sq.c.disponibles, 0).label("unidades_disponibles"),
            )
            .join(Producto, Variante.producto_id == Producto.id)
            .join(AssetFamily, Producto.family_id == AssetFamily.id)
            .outerjoin(sq, sq.c.variante_id == Variante.id)
            .where(Variante.tenant_id == self.tenant_id)
            .options(
                selectinload(Variante.producto).selectinload(Producto.family),
                selectinload(Variante.codigos).selectinload(Codigo.proveedor),
                selectinload(Variante.ubicacion),
            )
        )
        return query, sq

    @staticmethod
    def stock_efectivo(variante: Variante, comportamiento: str, disponibles: int) -> Decimal:
        """La columna si es consumible, el conteo de disponibles si es prestable."""
        if comportamiento == "prestable":
            return Decimal(disponibles)
        return variante.stock_actual

    # ── Consultas ────────────────────────────────────────────────────────────

    async def listar(
        self,
        comportamiento: str | None = None,
        producto_id: int | None = None,
        buscar: str | None = None,
        atributo: tuple[str, str] | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[tuple[Variante, int, int]]:
        query, _ = self._query_con_conteos()

        if comportamiento:
            query = query.where(AssetFamily.comportamiento == comportamiento)
        if producto_id:
            query = query.where(Variante.producto_id == producto_id)
        if buscar:
            patron = f"%{buscar.strip()}%"
            query = query.where(Producto.nombre.ilike(patron) | Variante.nombre.ilike(patron))
        if atributo:
            clave, valor = atributo
            query = query.where(Variante.atributos[clave].astext == valor)

        query = query.order_by(Producto.nombre, Variante.nombre).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def contar(
        self, comportamiento: str | None = None, producto_id: int | None = None
    ) -> int:
        query = (
            select(func.count())
            .select_from(Variante)
            .join(Producto, Variante.producto_id == Producto.id)
            .join(AssetFamily, Producto.family_id == AssetFamily.id)
            .where(Variante.tenant_id == self.tenant_id)
        )
        if comportamiento:
            query = query.where(AssetFamily.comportamiento == comportamiento)
        if producto_id:
            query = query.where(Variante.producto_id == producto_id)
        result = await self.session.execute(query)
        return result.scalar_one()

    async def get_con_conteos(self, variante_id: int) -> tuple[Variante, int, int] | None:
        query, _ = self._query_con_conteos()
        result = await self.session.execute(query.where(Variante.id == variante_id))
        row = result.first()
        return (row[0], row[1], row[2]) if row else None

    async def get_por_nombre(self, producto_id: int, nombre: str) -> Variante | None:
        """Upsert de la importación: la clave es (producto, variante)."""
        result = await self.session.execute(
            self._base_query()
            .where(Variante.producto_id == producto_id)
            .where(func.lower(Variante.nombre) == nombre.strip().lower())
        )
        return result.scalar_one_or_none()

    async def bajo_stock(self) -> list[tuple[Variante, int, int]]:
        """Quiebres unificados: consumibles por columna, herramientas por conteo.

        `stock_minimo = 0` desactiva la alerta — si no, todo el catálogo sin
        mínimo configurado aparecería como quiebre permanente.
        """
        query, sq = self._query_con_conteos()
        query = query.where(Variante.stock_minimo > 0).where(
            case(
                (
                    AssetFamily.comportamiento == "prestable",
                    func.coalesce(sq.c.disponibles, 0) <= Variante.stock_minimo,
                ),
                else_=Variante.stock_actual <= Variante.stock_minimo,
            )
        )
        result = await self.session.execute(query)
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def claves_de_atributo(self, producto_id: int) -> list[str]:
        """Claves ya usadas en las variantes del producto, para autocompletar.

        Restricción blanda a propósito: la alternativa rígida es una tabla de
        definición de atributos por tenant, que es mantención que nadie va a hacer.
        """
        result = await self.session.execute(
            select(func.jsonb_object_keys(Variante.atributos))
            .where(Variante.tenant_id == self.tenant_id)
            .where(Variante.producto_id == producto_id)
            .distinct()
        )
        return sorted(result.scalars().all())

    async def valor_bodega(self, limite_detalle: int = 10) -> dict:
        """Cuánta plata hay parada en bodega, y dónde se concentra.

        Existencias y herramientas van separadas: la primera es capital de trabajo
        —dinero que salió de la caja y no vuelve hasta que el material se consuma—
        y la segunda activo fijo. Sumarlas daría un número sin significado.

        Los consumibles se valorizan a precio de compra, que es el dinero ya
        gastado; las herramientas a valor de reposición, que es lo que costaría
        reemplazarlas.
        """
        from app.models.codigo import Codigo
        from app.models.inventory_log import InventoryLog

        ultimo_mov = (
            select(
                InventoryLog.variante_id.label("variante_id"),
                func.max(InventoryLog.fecha_hora).label("ultima"),
            )
            .where(InventoryLog.tenant_id == self.tenant_id)
            .group_by(InventoryLog.variante_id)
            .subquery()
        )
        principal = (
            select(Codigo.variante_id, Codigo.codigo)
            .where(Codigo.tenant_id == self.tenant_id)
            .where(Codigo.es_principal.is_(True))
            .where(Codigo.variante_id.isnot(None))
            .subquery()
        )
        conteos = self._conteos_sq()

        filas = (
            await self.session.execute(
                select(
                    Variante,
                    AssetFamily.comportamiento,
                    AssetFamily.color,
                    Producto.nombre.label("producto_nombre"),
                    principal.c.codigo,
                    func.coalesce(conteos.c.en_parque, 0).label("en_parque"),
                    ultimo_mov.c.ultima,
                )
                .join(Producto, Variante.producto_id == Producto.id)
                .join(AssetFamily, Producto.family_id == AssetFamily.id)
                .outerjoin(conteos, conteos.c.variante_id == Variante.id)
                .outerjoin(principal, principal.c.variante_id == Variante.id)
                .outerjoin(ultimo_mov, ultimo_mov.c.variante_id == Variante.id)
                .where(Variante.tenant_id == self.tenant_id)
            )
        ).all()

        ahora = datetime.now(timezone.utc)
        existencias = Decimal(0)
        herramientas = Decimal(0)
        sin_precio = 0
        detalle = []

        for v, comportamiento, color, producto_nombre, codigo, en_parque, ultima in filas:
            prestable = comportamiento == "prestable"
            # Todas las unidades salvo las robadas: una prestada o en reparación
            # sigue siendo un activo del tenant, sólo que no está en la repisa.
            cantidad = Decimal(en_parque) if prestable else v.stock_actual
            precio = v.valor_reposicion if prestable else v.precio_compra

            if precio is None:
                # Sin precio queda sin valorizar, nunca en cero: un cero afirma que
                # no vale nada, y lo que pasa es que no se sabe cuánto vale.
                if cantidad:
                    sin_precio += 1
                continue

            valor = Decimal(cantidad) * Decimal(precio)
            if prestable:
                herramientas += valor
            else:
                existencias += valor

            detalle.append({
                "asset_id": v.id,
                "uid_fisico": codigo or f"#{v.id}",
                "nombre": f"{producto_nombre} · {v.nombre}",
                "comportamiento": comportamiento,
                "family_color": color,
                "stock_actual": cantidad,
                "unidad": v.unidad,
                "valor_unitario": Decimal(precio),
                "valor": valor,
                "dias_sin_movimiento": (ahora - ultima).days if ultima else 0,
            })

        # El que más plata acumula primero: es donde mirar
        detalle.sort(key=lambda x: x["valor"], reverse=True)
        return {
            "existencias": existencias,
            "herramientas": herramientas,
            "activos_sin_precio": sin_precio,
            "detalle": detalle[:limite_detalle],
        }

    async def contar_unidades(self, variante_id: int) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Unidad)
            .where(Unidad.variante_id == variante_id)
            .where(Unidad.tenant_id == self.tenant_id)
        )
        return result.scalar_one()
