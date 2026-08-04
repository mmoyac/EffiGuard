from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Proveedor(Base):
    """
    Catálogo de proveedores del tenant.

    Existe para que un código pueda decir de quién viene, en vez de repetir
    "Sodimac" como texto en cada fila. No lleva precios ni condiciones: eso es
    compras, y compras no está en este alcance.
    """

    __tablename__ = "proveedores"
    __table_args__ = (
        # Único por tenant: la importación Excel crea proveedores por nombre.
        UniqueConstraint("tenant_id", "nombre", name="uq_proveedores_tenant_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    nombre: Mapped[str] = mapped_column(String(150))
    rut: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contacto: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    codigos: Mapped[list["Codigo"]] = relationship(back_populates="proveedor")
