from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RoleMenuPermission(Base):
    __tablename__ = "role_menu_permissions"
    __table_args__ = (UniqueConstraint("role_id", "menu_item_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))

    role: Mapped["Role"] = relationship(back_populates="menu_permissions")
    menu_item: Mapped["MenuItem"] = relationship(back_populates="permissions")
