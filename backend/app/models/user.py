from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    # La credencial es única DENTRO del tenant, no entre tenants: la tarjeta Bip!
    # es del trabajador y no de la empresa, así que el mismo maestro puede
    # trabajar para dos empresas del sistema y llevar una sola tarjeta.
    __table_args__ = (
        UniqueConstraint("tenant_id", "uid_credencial", name="uq_users_tenant_credencial"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    rut: Mapped[str] = mapped_column(String(20))
    nombre: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    uid_credencial: Mapped[str | None] = mapped_column(String(100))  # Tag RFID/NFC o QR empleado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")
    role: Mapped["Role"] = relationship(back_populates="users")
    loans_received: Mapped[list["Loan"]] = relationship(
        back_populates="user", foreign_keys="Loan.user_id"
    )
    loans_delivered: Mapped[list["Loan"]] = relationship(
        back_populates="bodeguero", foreign_keys="Loan.bodeguero_id"
    )
    inventory_logs: Mapped[list["InventoryLog"]] = relationship(
        back_populates="user", foreign_keys="InventoryLog.user_id"
    )
