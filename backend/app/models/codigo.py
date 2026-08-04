from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Qué responde cada tipo, y por eso de qué nivel puede colgar:
#   fabricante    ¿qué modelo es?                    → variante
#   proveedor     ¿con qué número me lo vende éste?  → variante
#   empaque       ¿cuántas trae esta caja?           → variante
#   serie_fabrica ¿cuál ejemplar es?                 → unidad
#   propio        el código que asigné yo            → cualquiera
TIPOS_VALIDOS = ("fabricante", "proveedor", "empaque", "propio", "serie_fabrica")
TIPOS_DE_VARIANTE = ("fabricante", "proveedor", "empaque")
TIPOS_DE_UNIDAD = ("serie_fabrica",)


class Codigo(Base):
    """
    Todo lo escaneable, en una sola tabla.

    Una tabla y no dos (`variante_codigos` + `unidades.uid_fisico`) por tres
    razones: las herramientas también necesitan varios códigos (el QR pegado y la
    serie de fábrica), el escaneo se resuelve con una sola consulta sin regla de
    precedencia inventada, y la unicidad la garantiza una restricción en vez de la
    disciplina de la aplicación.
    """

    __tablename__ = "codigos"
    __table_args__ = (
        # La unicidad es por tenant, no global: dos clientes que le compran a la
        # misma marca comparten el EAN de fábrica y chocarían siempre.
        UniqueConstraint("tenant_id", "codigo", name="uq_codigos_tenant_codigo"),
        CheckConstraint(
            "(variante_id IS NOT NULL AND unidad_id IS NULL) "
            "OR (variante_id IS NULL AND unidad_id IS NOT NULL)",
            name="ck_codigos_un_solo_dueno",
        ),
        CheckConstraint("factor > 0", name="ck_codigos_factor_positivo"),
        # A lo más un principal por dueño. Índice parcial y no UNIQUE a secas
        # porque los no-principales son muchos por item.
        Index(
            "uq_codigos_principal_variante",
            "variante_id",
            unique=True,
            postgresql_where=("es_principal AND variante_id IS NOT NULL"),
        ),
        Index(
            "uq_codigos_principal_unidad",
            "unidad_id",
            unique=True,
            postgresql_where=("es_principal AND unidad_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)

    # Exactamente uno de los dos, garantizado por CHECK.
    variante_id: Mapped[int | None] = mapped_column(
        ForeignKey("variantes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    unidad_id: Mapped[int | None] = mapped_column(
        ForeignKey("unidades.id", ondelete="CASCADE"), nullable=True, index=True
    )

    codigo: Mapped[str] = mapped_column(String(100))
    tipo: Mapped[str] = mapped_column(String(20))
    proveedor_id: Mapped[int | None] = mapped_column(ForeignKey("proveedores.id"), nullable=True)

    # Cuántas unidades de stock representa este código. La caja de un proveedor
    # trae 100 y la del otro 250: por eso el contenido vive acá y no en la variante.
    factor: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1, server_default="1")
    nombre_empaque: Mapped[str | None] = mapped_column(String(20), nullable=True)  # caja, rollo, tambor…

    # El que se muestra en listados y se imprime en la etiqueta. Reemplaza a
    # `uid_fisico` sin dejar dos fuentes de verdad.
    es_principal: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    variante: Mapped["Variante | None"] = relationship(back_populates="codigos")
    unidad: Mapped["Unidad | None"] = relationship(back_populates="codigos")
    proveedor: Mapped["Proveedor | None"] = relationship(back_populates="codigos")
