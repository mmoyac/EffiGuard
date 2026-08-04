from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Ubicacion(Base):
    """
    Catálogo de posiciones físicas de bodega por tenant.
    Cada fila es una posición real (rack + nivel + posición), no un componente suelto:
    un 'nivel 5' no existe con independencia de su rack.
    """

    __tablename__ = "ubicaciones"
    __table_args__ = (
        UniqueConstraint("tenant_id", "rack", "nivel", "posicion", name="uq_ubicaciones_tenant_posicion"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    rack: Mapped[str] = mapped_column(String(20))       # Se almacena normalizado: trim + mayúsculas
    nivel: Mapped[str] = mapped_column(String(20))
    posicion: Mapped[str] = mapped_column(String(20))
    descripcion: Mapped[str | None] = mapped_column(String(200), nullable=True)

    tenant: Mapped["Tenant"] = relationship()
    variantes: Mapped[list["Variante"]] = relationship(back_populates="ubicacion")
