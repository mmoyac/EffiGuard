from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssetState(Base):
    __tablename__ = "asset_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True)  # Disponible, En Terreno, Reparación, Robado

    assets: Mapped[list["Asset"]] = relationship(back_populates="estado")
