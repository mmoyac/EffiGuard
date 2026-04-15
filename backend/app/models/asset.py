from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    uid_fisico: Mapped[str] = mapped_column(String(100), unique=True)  # Código QR o Tag RFID
    nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    parent_asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    model_id: Mapped[int | None] = mapped_column(ForeignKey("models.id"), nullable=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("asset_families.id"))
    estado_id: Mapped[int] = mapped_column(ForeignKey("asset_states.id"))
    stock_actual: Mapped[int] = mapped_column(Integer, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, default=0)
    valor_reposicion: Mapped[float | None] = mapped_column(Numeric(12, 2))
    dias_max_prestamo: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = usa el de la familia
    proxima_mantencion: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="assets")
    family: Mapped["AssetFamily"] = relationship(back_populates="assets")
    model: Mapped["AssetModel"] = relationship(back_populates="assets")
    estado: Mapped["AssetState"] = relationship(back_populates="assets")

    # Lógica Kits (Padre-Hijo)
    parent: Mapped["Asset | None"] = relationship(back_populates="children", remote_side="Asset.id")
    children: Mapped[list["Asset"]] = relationship(back_populates="parent")

    loans: Mapped[list["Loan"]] = relationship(back_populates="asset")
    inventory_logs: Mapped[list["InventoryLog"]] = relationship(back_populates="asset")
