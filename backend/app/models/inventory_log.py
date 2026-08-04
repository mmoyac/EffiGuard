from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    # Toda posición de stock que se mueve es una variante, así que el consumo por
    # proyecto y la valorización se calculan igual para herramientas y consumibles.
    variante_id: Mapped[int] = mapped_column(ForeignKey("variantes.id"), index=True)
    # Sólo cuando el movimiento identifica un ejemplar concreto.
    unidad_id: Mapped[int | None] = mapped_column(ForeignKey("unidades.id"), nullable=True)
    # Código escaneado en una compra: permite auditar contra la factura del
    # proveedor (de quién vino y en qué empaque). Borrarlo no invalida el movimiento.
    codigo_id: Mapped[int | None] = mapped_column(
        ForeignKey("codigos.id", ondelete="SET NULL"), nullable=True
    )
    proveedor_id: Mapped[int | None] = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    operario_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    # Movimiento del que proviene éste. Sólo lo usa el reintegro, que apunta a su despacho de origen.
    origen_log_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_logs.id"), nullable=True, index=True)
    tipo_movimiento: Mapped[str] = mapped_column(String(30))  # entrega, devolucion, ajuste, compra, perdida, merma, reintegro, reparacion, reparacion_completada
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    # Precio congelado al momento del movimiento: si el costo se recalculara desde
    # el activo, subir el precio mañana cambiaría lo que costó una obra del año
    # pasado. 4 decimales porque el unitario suele ser una fracción.
    costo_unitario: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    observaciones: Mapped[str | None] = mapped_column(Text)

    variante: Mapped["Variante"] = relationship()
    unidad: Mapped["Unidad | None"] = relationship()
    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="inventory_logs")
    operario: Mapped["User | None"] = relationship(foreign_keys=[operario_id])

    # Adjacency list: un despacho tiene N reintegros, cada reintegro tiene un despacho
    origen: Mapped["InventoryLog | None"] = relationship(
        back_populates="reintegros", remote_side="InventoryLog.id", foreign_keys=[origen_log_id]
    )
    reintegros: Mapped[list["InventoryLog"]] = relationship(
        back_populates="origen", foreign_keys=[origen_log_id]
    )
