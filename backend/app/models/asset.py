from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        # Único por tenant, no global: con códigos de fabricante (EAN) dos clientes
        # que le compran a la misma marca chocarían siempre.
        UniqueConstraint("tenant_id", "uid_fisico", name="uq_assets_tenant_uid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    uid_fisico: Mapped[str] = mapped_column(String(100))  # Código QR o Tag RFID: identifica ESTA unidad
    # Código de barras de fábrica (EAN/UPC/GTIN): identifica el PRODUCTO, no la
    # unidad, así que las unidades del mismo modelo lo comparten. No es único.
    codigo_fabricante: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    nombre: Mapped[str | None] = mapped_column(String(200), nullable=True)
    parent_asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    model_id: Mapped[int | None] = mapped_column(ForeignKey("models.id"), nullable=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("asset_families.id"))
    estado_id: Mapped[int] = mapped_column(ForeignKey("asset_states.id"))
    ubicacion_id: Mapped[int | None] = mapped_column(ForeignKey("ubicaciones.id"), nullable=True)
    # Cantidades decimales: hay consumibles que se miden (metros, kilos), no sólo se cuentan
    stock_actual: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    unidad: Mapped[str] = mapped_column(String(10), default="unidad", server_default="unidad")  # unidad | metro | kilo | litro
    # Se compra por empaque (caja, rollo) pero se despacha por unidad. El stock
    # vive en la unidad de despacho; esto sólo traduce al ingresar una compra.
    contenido_por_empaque: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    nombre_empaque: Mapped[str | None] = mapped_column(String(20), nullable=True)  # caja, rollo, tambor, saco…
    # Costo de UNA unidad de stock (un tornillo, un metro), no del empaque.
    # Distinto de valor_reposicion: éste valoriza los movimientos, aquél la pérdida.
    precio_compra: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_reposicion: Mapped[float | None] = mapped_column(Numeric(12, 2))
    dias_max_prestamo: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = usa el de la familia
    proxima_mantencion: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="assets")
    family: Mapped["AssetFamily"] = relationship(back_populates="assets")
    model: Mapped["AssetModel"] = relationship(back_populates="assets")
    estado: Mapped["AssetState"] = relationship(back_populates="assets")
    ubicacion: Mapped["Ubicacion | None"] = relationship(back_populates="assets")

    # Lógica Kits (Padre-Hijo)
    parent: Mapped["Asset | None"] = relationship(back_populates="children", remote_side="Asset.id")
    children: Mapped[list["Asset"]] = relationship(back_populates="parent")

    loans: Mapped[list["Loan"]] = relationship(back_populates="asset")
    inventory_logs: Mapped[list["InventoryLog"]] = relationship(back_populates="asset")
