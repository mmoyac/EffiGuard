from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Variante(Base):
    """
    El SKU: "6x40 zincado". LA posición de stock, de precio y de código de barras.

    Es el nivel que responde "¿el que lo va a usar nota la diferencia?". Un tornillo
    6x40 y uno 8x60 son variantes distintas porque no son intercambiables en la obra.
    El mismo tornillo comprado a tres proveedores es UNA variante con tres códigos:
    partir el stock por proveedor rompería la alerta de mínimo y obligaría al
    bodeguero a elegir de qué pila descontar, cuando al maestro le da lo mismo.
    """

    __tablename__ = "variantes"
    __table_args__ = (
        UniqueConstraint("producto_id", "nombre", name="uq_variantes_producto_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), index=True)

    # Texto escrito a mano, no derivado de los atributos: la concatenación
    # automática produce "6x40 / zincado / DIN-7504", que no es como nadie nombra
    # un tornillo. Los atributos sirven para filtrar; el nombre, para leer.
    nombre: Mapped[str] = mapped_column(String(200))
    # {"medida": "6x40", "material": "zincado"}. JSONB y no columnas fijas porque
    # los atributos que importan dependen del rubro del tenant.
    atributos: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    unidad: Mapped[str] = mapped_column(String(10), default="unidad", server_default="unidad")

    # Sólo se escribe para consumibles. El stock de una variante prestable es el
    # conteo de sus unidades disponibles y NO se almacena: un contador que puede
    # descuadrarse contra los datos que tiene al lado no vale lo que ahorra.
    stock_actual: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")
    # Aplica a ambos comportamientos: "al menos 2 taladros libres" es una alerta
    # tan válida como "al menos 500 tornillos". En 0 la alerta queda desactivada.
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0, server_default="0")

    precio_compra: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_reposicion: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    dias_max_prestamo: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = hereda de la familia

    # Para consumibles es la repisa del pozo. Para prestables es el default que
    # usan las unidades que no declaran la suya.
    ubicacion_id: Mapped[int | None] = mapped_column(ForeignKey("ubicaciones.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    producto: Mapped["Producto"] = relationship(back_populates="variantes")
    ubicacion: Mapped["Ubicacion | None"] = relationship()
    unidades: Mapped[list["Unidad"]] = relationship(
        back_populates="variante", cascade="all, delete-orphan"
    )
    codigos: Mapped[list["Codigo"]] = relationship(
        back_populates="variante", cascade="all, delete-orphan"
    )
