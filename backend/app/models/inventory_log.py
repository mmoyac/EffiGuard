from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    tipo_movimiento: Mapped[str] = mapped_column(String(30))  # entrega, devolucion, ajuste, compra, perdida
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    observaciones: Mapped[str | None] = mapped_column(Text)

    asset: Mapped["Asset"] = relationship(back_populates="inventory_logs")
    user: Mapped["User"] = relationship(back_populates="inventory_logs")
