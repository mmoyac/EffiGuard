from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    icono: Mapped[str | None] = mapped_column(String(50))
    orden: Mapped[int] = mapped_column(Integer, default=0)

    menu_items: Mapped[list["MenuItem"]] = relationship(back_populates="module")
