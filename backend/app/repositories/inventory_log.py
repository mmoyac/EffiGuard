from decimal import Decimal

from sqlalchemy import case, func, or_ as sa_or, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.asset_family import AssetFamily
from app.models.inventory_log import InventoryLog
from app.models.producto import Producto
from app.models.project import Project
from app.models.user import User
from app.models.variante import Variante
from app.repositories.base import BaseRepository


class InventoryLogRepository(BaseRepository[InventoryLog]):
    def __init__(self, session: AsyncSession, tenant_id: int):
        super().__init__(InventoryLog, session, tenant_id)

    async def create(self, **kwargs) -> InventoryLog:
        """Estampa el costo unitario vigente del activo en todo movimiento nuevo.

        Se hace acá y no en cada servicio a propósito: hay nueve tipos de
        movimiento creados desde media docena de funciones, y basta que una olvide
        el costo para que un proyecto quede mal costeado sin que nadie lo note.
        """
        if "costo_unitario" not in kwargs and kwargs.get("variante_id"):
            precio = (
                await self.session.execute(
                    select(Variante.precio_compra)
                    .where(Variante.id == kwargs["variante_id"])
                    .where(Variante.tenant_id == self.tenant_id)
                )
            ).scalar_one_or_none()
            # None si el activo no tiene precio: queda sin valorizar, no en cero
            kwargs["costo_unitario"] = precio
        return await super().create(**kwargs)

    async def list_by_unidad(self, unidad_id: int) -> list[InventoryLog]:
        """Historial de un ejemplar concreto: préstamos, reparaciones, pérdida."""
        result = await self.session.execute(
            self._base_query()
            .where(InventoryLog.unidad_id == unidad_id)
            .order_by(InventoryLog.fecha_hora.desc())
        )
        return list(result.scalars().all())

    # ── Saldos de despacho ───────────────────────────────────────────────────
    # El saldo pendiente es lo despachado menos lo reintegrado. Se calcula al
    # consultar en vez de guardarse en una columna: un valor derivado almacenado
    # es un estado más que puede quedar desincronizado, y el volumen de
    # reintegros por despacho es bajo.

    def _reintegrado_subq(self):
        """Suma de reintegros por despacho de origen."""
        return (
            select(
                InventoryLog.origen_log_id.label("origen_id"),
                func.coalesce(func.sum(InventoryLog.cantidad), 0).label("reintegrado"),
            )
            .where(InventoryLog.tenant_id == self.tenant_id)
            .where(InventoryLog.tipo_movimiento == "reintegro")
            .where(InventoryLog.origen_log_id.is_not(None))
            .group_by(InventoryLog.origen_log_id)
            .subquery()
        )

    async def saldo_pendiente(self, despacho_id: int) -> Decimal | None:
        """Saldo aún no reintegrado de un despacho. None si el despacho no existe
        en el tenant o no es una entrega."""
        despacho = await self.get(despacho_id)
        if not despacho or despacho.tipo_movimiento != "entrega":
            return None

        reintegrado = (
            await self.session.execute(
                select(func.coalesce(func.sum(InventoryLog.cantidad), 0))
                .where(InventoryLog.tenant_id == self.tenant_id)
                .where(InventoryLog.tipo_movimiento == "reintegro")
                .where(InventoryLog.origen_log_id == despacho_id)
            )
        ).scalar_one()

        return Decimal(despacho.cantidad) - Decimal(reintegrado)

    async def tiene_reintegro(self, despacho_id: int) -> bool:
        """Un despacho con reintegro está cerrado: sólo admite uno."""
        result = await self.session.execute(
            select(func.count())
            .select_from(InventoryLog)
            .where(InventoryLog.tenant_id == self.tenant_id)
            .where(InventoryLog.tipo_movimiento == "reintegro")
            .where(InventoryLog.origen_log_id == despacho_id)
        )
        return result.scalar_one() > 0

    async def despachos_abiertos_variante(self, variante_id: int) -> list[dict]:
        """Despachos de una variante que todavía admiten reintegro.

        Comparte el cuerpo con la versión sobre `assets`: sólo cambia por qué
        columna se filtra, y duplicar la consulta entera sería duplicar también
        las tres reglas de "abierto".
        """
        return await self._despachos_abiertos(InventoryLog.variante_id == variante_id)

    async def _despachos_abiertos(self, filtro) -> list[dict]:
        sub = self._reintegrado_subq()
        Operario = aliased(User, name="operario")

        saldo = InventoryLog.cantidad - func.coalesce(sub.c.reintegrado, 0)

        rows = (
            await self.session.execute(
                select(
                    InventoryLog.id,
                    InventoryLog.cantidad,
                    InventoryLog.fecha_hora,
                    InventoryLog.observaciones,
                    func.coalesce(sub.c.reintegrado, 0).label("reintegrado"),
                    saldo.label("saldo"),
                    Operario.nombre.label("operario_nombre"),
                    Project.nombre.label("proyecto_nombre"),
                )
                .outerjoin(sub, sub.c.origen_id == InventoryLog.id)
                .outerjoin(Operario, InventoryLog.operario_id == Operario.id)
                .outerjoin(Project, InventoryLog.project_id == Project.id)
                .where(InventoryLog.tenant_id == self.tenant_id)
                .where(filtro)
                .where(InventoryLog.tipo_movimiento == "entrega")
                # Un solo reintegro por despacho: si ya tiene uno, está cerrado
                .where(sub.c.origen_id.is_(None))
                # Obra terminada = material declarado consumido. Sin proyecto no
                # hay evento de cierre, así que sigue abierto.
                .where(sa_or(InventoryLog.project_id.is_(None), Project.is_active.is_(True)))
                .order_by(InventoryLog.fecha_hora.desc())
            )
        ).all()

        return [
            {
                "despacho_id": r.id,
                "cantidad_despachada": r.cantidad,
                "cantidad_reintegrada": r.reintegrado,
                "saldo_pendiente": r.saldo,
                "fecha_hora": r.fecha_hora,
                "operario_nombre": r.operario_nombre,
                "proyecto_nombre": r.proyecto_nombre,
                "observaciones": r.observaciones,
            }
            for r in rows
        ]

    async def costo_materiales_por_proyecto(self, solo_activos: bool = True) -> list[dict]:
        """Costo del material imputado a cada proyecto, en tres líneas separadas.

        Consumo, pérdidas y mermas no se suman: si el robo se diluye dentro del
        consumo nadie lo ve, que es justamente lo que este sistema existe para
        exponer.

        Las pérdidas de activos prestables se valorizan a valor de reposición —lo
        que cuesta reemplazar la herramienta— y las de consumibles al costo
        congelado, que es el dinero ya gastado en ellas.
        """
        costo_mov = InventoryLog.cantidad * InventoryLog.costo_unitario

        es_prestable = AssetFamily.comportamiento == "prestable"
        reposicion = Variante.valor_reposicion

        # Una herramienta perdida se valoriza a reposición; el resto, al congelado
        costo_perdida = case(
            (es_prestable, reposicion),
            else_=costo_mov,
        )
        # Y por lo mismo, "valorizado" significa cosas distintas según el caso
        perdida_valorizada = case(
            (es_prestable, reposicion.is_not(None)),
            else_=InventoryLog.costo_unitario.is_not(None),
        )

        def suma(expr, tipo: str):
            return func.coalesce(func.sum(expr).filter(InventoryLog.tipo_movimiento == tipo), 0)

        def sin_valorizar(tipos: tuple[str, ...]):
            # Sólo consumibles: prestar una herramienta a una obra no le imputa
            # material, así que su entrega no tiene costo que estampar y contarla
            # como "sin valorizar" inflaría la advertencia con movimientos que
            # nunca debieron llevar precio.
            return func.count().filter(
                InventoryLog.tipo_movimiento.in_(tipos),
                InventoryLog.costo_unitario.is_(None),
                AssetFamily.comportamiento == "consumible",
            )

        q = (
            select(
                Project.id.label("project_id"),
                Project.nombre.label("proyecto_nombre"),
                (suma(costo_mov, "entrega") - suma(costo_mov, "reintegro")).label("consumo"),
                # Neto de reingresos: una herramienta que apareció dejó de ser
                # pérdida, y la obra no debe seguir cargando su costo.
                (
                    func.coalesce(
                        func.sum(costo_perdida).filter(
                            InventoryLog.tipo_movimiento == "perdida"
                        ),
                        0,
                    )
                    - func.coalesce(
                        func.sum(costo_mov).filter(
                            InventoryLog.tipo_movimiento == "reingreso"
                        ),
                        0,
                    )
                ).label("perdidas"),
                suma(costo_mov, "merma").label("mermas"),
                (
                    sin_valorizar(("entrega", "reintegro", "merma"))
                    + func.count().filter(
                        InventoryLog.tipo_movimiento == "perdida",
                        ~perdida_valorizada,
                    )
                ).label("sin_valorizar"),
            )
            .select_from(InventoryLog)
            .join(Project, InventoryLog.project_id == Project.id)
            .join(Variante, InventoryLog.variante_id == Variante.id)
            .join(Producto, Variante.producto_id == Producto.id)
            .join(AssetFamily, Producto.family_id == AssetFamily.id)
            .where(InventoryLog.tenant_id == self.tenant_id)
            .group_by(Project.id, Project.nombre)
        )
        if solo_activos:
            # El panel es operativo: sólo obras donde todavía se puede decidir
            q = q.where(Project.is_active.is_(True))

        rows = (await self.session.execute(q)).all()

        resultado = [
            {
                "project_id": r.project_id,
                "proyecto_nombre": r.proyecto_nombre,
                "consumo": r.consumo,
                "perdidas": r.perdidas,
                "mermas": r.mermas,
                "total": (r.consumo or 0) + (r.perdidas or 0) + (r.mermas or 0),
                "movimientos_sin_valorizar": r.sin_valorizar,
            }
            for r in rows
        ]
        # El más caro primero: es lo que el jefe de bodega quiere ver
        resultado.sort(key=lambda x: x["total"], reverse=True)
        return resultado

    async def materiales_de_proyecto(self, project_id: int) -> list[dict]:
        """Qué materiales consumió una obra, en cantidad y en plata.

        El total del panel responde *cuánto* gastó la obra; esto responde *en qué*,
        que es lo que permite decidir. Un gasto alto en un consumible barato es un
        problema de control; el mismo monto en uno caro puede ser el proyecto normal.

        La cantidad es neta —despachado menos reintegrado—: si salieron 100 y
        volvieron 20, la obra ocupó 80, no 100.
        """
        def suma_cant(tipo: str):
            return func.coalesce(
                func.sum(InventoryLog.cantidad).filter(InventoryLog.tipo_movimiento == tipo), 0
            )

        def suma_costo(tipo: str):
            return func.coalesce(
                func.sum(InventoryLog.cantidad * InventoryLog.costo_unitario).filter(
                    InventoryLog.tipo_movimiento == tipo
                ),
                0,
            )

        entregado, reintegrado = suma_cant("entrega"), suma_cant("reintegro")

        nombre = Producto.nombre + " · " + Variante.nombre
        unidad = Variante.unidad

        q = (
            select(
                InventoryLog.variante_id,
                nombre.label("nombre"),
                unidad.label("unidad"),
                (entregado - reintegrado).label("cantidad"),
                entregado.label("despachado"),
                reintegrado.label("reintegrado"),
                suma_cant("merma").label("merma"),
                suma_cant("perdida").label("perdida"),
                (suma_costo("entrega") - suma_costo("reintegro")).label("costo_consumo"),
                (suma_costo("merma") + suma_costo("perdida")).label("costo_perdido"),
            )
            .select_from(InventoryLog)
            .join(Variante, InventoryLog.variante_id == Variante.id)
            .join(Producto, Variante.producto_id == Producto.id)
            .where(InventoryLog.tenant_id == self.tenant_id)
            .where(InventoryLog.project_id == project_id)
            .where(
                InventoryLog.tipo_movimiento.in_(("entrega", "reintegro", "merma", "perdida"))
            )
            .group_by(InventoryLog.variante_id, nombre, unidad)
        )

        filas = [
            {
                "variante_id": r.variante_id,
                "nombre": r.nombre,
                "unidad": r.unidad,
                "cantidad": r.cantidad,
                "despachado": r.despachado,
                "reintegrado": r.reintegrado,
                "merma": r.merma,
                "perdida": r.perdida,
                "costo": (r.costo_consumo or 0) + (r.costo_perdido or 0),
            }
            for r in (await self.session.execute(q)).all()
        ]
        # El más caro primero: es el que justifica mirar
        filas.sort(key=lambda x: x["costo"], reverse=True)
        return filas

    async def consumo_por_proyecto(self, variante_id: int | None = None) -> list[dict]:
        """Consumo neto por proyecto: despachado menos reintegrado.

        Es distinto de lo retirado: si salieron 100 m y volvieron 20, el proyecto
        consumió 80, no 100.
        """
        despachado = func.coalesce(
            func.sum(InventoryLog.cantidad).filter(InventoryLog.tipo_movimiento == "entrega"), 0
        )
        reintegrado = func.coalesce(
            func.sum(InventoryLog.cantidad).filter(InventoryLog.tipo_movimiento == "reintegro"), 0
        )

        q = (
            select(
                InventoryLog.project_id,
                Project.nombre.label("proyecto_nombre"),
                despachado.label("despachado"),
                reintegrado.label("reintegrado"),
                (despachado - reintegrado).label("consumo_neto"),
            )
            .outerjoin(Project, InventoryLog.project_id == Project.id)
            .where(InventoryLog.tenant_id == self.tenant_id)
            .where(InventoryLog.tipo_movimiento.in_(("entrega", "reintegro")))
            .group_by(InventoryLog.project_id, Project.nombre)
        )
        if variante_id is not None:
            q = q.where(InventoryLog.variante_id == variante_id)

        rows = (await self.session.execute(q)).all()
        return [
            {
                "project_id": r.project_id,
                "proyecto_nombre": r.proyecto_nombre,
                "despachado": r.despachado,
                "reintegrado": r.reintegrado,
                "consumo_neto": r.consumo_neto,
            }
            for r in rows
        ]
