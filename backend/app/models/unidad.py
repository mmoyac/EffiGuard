from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Unidad(Base):
    """
    El ejemplar físico de una herramienta: este taladro, no "un taladro".

    Sólo existe para familias prestables — es lo que se presta, se devuelve y se
    manda a reparar. Su identificador no vive acá sino en `codigos`, porque un
    mismo ejemplar puede tener varios: el QR que le pegó el bodeguero y el número
    de serie de fábrica.
    """

    __tablename__ = "unidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    variante_id: Mapped[int] = mapped_column(ForeignKey("variantes.id", ondelete="CASCADE"), index=True)
    estado_id: Mapped[int] = mapped_column(ForeignKey("asset_states.id"))

    # Gana sobre la de la variante. Dos taladros del mismo modelo pueden estar en
    # racks distintos, así que acá la ubicación es del ejemplar, no del catálogo.
    ubicacion_id: Mapped[int | None] = mapped_column(ForeignKey("ubicaciones.id"), nullable=True)

    # Kits: un conjunto de ejemplares que se prestan juntos. La jerarquía vive en
    # este nivel porque un kit es una caja concreta, no "la idea de caja".
    parent_unidad_id: Mapped[int | None] = mapped_column(ForeignKey("unidades.id"), nullable=True)

    proxima_mantencion: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    variante: Mapped["Variante"] = relationship(back_populates="unidades")
    estado: Mapped["AssetState"] = relationship()
    ubicacion: Mapped["Ubicacion | None"] = relationship()

    parent: Mapped["Unidad | None"] = relationship(back_populates="children", remote_side="Unidad.id")
    children: Mapped[list["Unidad"]] = relationship(back_populates="parent")

    codigos: Mapped[list["Codigo"]] = relationship(
        back_populates="unidad", cascade="all, delete-orphan"
    )
    loans: Mapped[list["Loan"]] = relationship(back_populates="unidad")
