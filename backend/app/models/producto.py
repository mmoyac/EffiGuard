from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Producto(Base):
    """
    El bien conceptual: "Tornillo autoperforante", "Taladro percutor GSB-13RE".

    Agrupa y describe, pero NO tiene stock ni precio: lo comprable es una variante
    suya. Un producto de familia prestable es, en la práctica, un modelo de
    herramienta — por eso este concepto reemplaza a la vieja tabla `models`.
    """

    __tablename__ = "productos"
    __table_args__ = (
        # Único por tenant: la importación Excel hace upsert por nombre.
        UniqueConstraint("tenant_id", "nombre", name="uq_productos_tenant_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    # El comportamiento (prestable/consumible) se hereda de acá hacia variantes y
    # unidades. Ningún nivel de abajo declara su tipo.
    family_id: Mapped[int] = mapped_column(ForeignKey("asset_families.id"))
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    family: Mapped["AssetFamily"] = relationship()
    brand: Mapped["Brand | None"] = relationship()
    variantes: Mapped[list["Variante"]] = relationship(
        back_populates="producto", cascade="all, delete-orphan"
    )
