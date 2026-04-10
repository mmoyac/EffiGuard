from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssetModel(Base):
    __tablename__ = "models"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    nombre: Mapped[str] = mapped_column(String(100))

    brand: Mapped["Brand"] = relationship(back_populates="models")
    assets: Mapped[list["Asset"]] = relationship(back_populates="model")
