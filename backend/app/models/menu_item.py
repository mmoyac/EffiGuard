from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("menu_items.id"), nullable=True)
    label: Mapped[str] = mapped_column(String(100))
    ruta: Mapped[str] = mapped_column(String(200))
    icono: Mapped[str | None] = mapped_column(String(50))
    orden: Mapped[int] = mapped_column(Integer, default=0)

    module: Mapped["Module"] = relationship(back_populates="menu_items")
    parent: Mapped["MenuItem | None"] = relationship(back_populates="children", remote_side="MenuItem.id")
    children: Mapped[list["MenuItem"]] = relationship(back_populates="parent")
    permissions: Mapped[list["RoleMenuPermission"]] = relationship(back_populates="menu_item")
