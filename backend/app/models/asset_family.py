from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssetFamily(Base):
    __tablename__ = "asset_families"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(100))
    comportamiento: Mapped[str] = mapped_column(String(20))  # prestable | consumible
    color: Mapped[str] = mapped_column(String(20))  # blue | orange | green | purple | red | yellow | pink | cyan
    dias_max_prestamo: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = sin límite

    tenant: Mapped["Tenant"] = relationship(back_populates="asset_families")
    assets: Mapped[list["Asset"]] = relationship(back_populates="family")
