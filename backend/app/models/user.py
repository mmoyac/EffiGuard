from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    rut: Mapped[str] = mapped_column(String(20))
    nombre: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    uid_credencial: Mapped[str | None] = mapped_column(String(100), unique=True)  # Tag RFID/NFC o QR empleado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
    role: Mapped["Role"] = relationship(back_populates="users")
    loans_received: Mapped[list["Loan"]] = relationship(
        back_populates="user", foreign_keys="Loan.user_id"
    )
    loans_delivered: Mapped[list["Loan"]] = relationship(
        back_populates="bodeguero", foreign_keys="Loan.bodeguero_id"
    )
    inventory_logs: Mapped[list["InventoryLog"]] = relationship(back_populates="user")
