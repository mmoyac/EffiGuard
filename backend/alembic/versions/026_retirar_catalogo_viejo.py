"""Retira el catálogo viejo: se eliminan `assets` y `models`

Revision ID: 026
Revises: 025
Create Date: 2026-08-03

Cierre de la migración por tramos. `inventory_logs.variante_id` pasa a NOT NULL:
todo movimiento pertenece a una posición de stock, y con el catálogo viejo fuera
esa posición es siempre una variante.

Es destructiva y no tiene vuelta: el downgrade recrea las tablas vacías, no los
datos. Se acepta porque `assets` ya está vacía —el catálogo se cargó como
productos y variantes— y porque el sistema todavía no está en producción.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Un activo con datos es inventario de alguien: no se borra en silencio.
    pendientes = conn.execute(sa.text("SELECT count(*) FROM assets")).scalar()
    if pendientes:
        raise RuntimeError(
            f"Quedan {pendientes} activo(s) en el catálogo viejo. "
            "Migre su inventario a productos y variantes antes de retirarlo."
        )

    # Movimientos sin variante sólo pueden venir del catálogo viejo.
    huerfanos = conn.execute(
        sa.text("SELECT count(*) FROM inventory_logs WHERE variante_id IS NULL")
    ).scalar()
    if huerfanos:
        raise RuntimeError(
            f"Hay {huerfanos} movimiento(s) sin variante, del catálogo viejo. "
            "Elimínelos o reasígnelos antes de continuar."
        )

    op.drop_column("inventory_logs", "asset_id")
    op.alter_column(
        "inventory_logs", "variante_id", existing_type=sa.Integer(), nullable=False
    )

    op.drop_table("assets")
    op.drop_table("models")


def downgrade() -> None:
    op.create_table(
        "models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("brand_id", sa.Integer(), sa.ForeignKey("brands.id"), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
    )
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("uid_fisico", sa.String(100), nullable=False),
        sa.Column("codigo_fabricante", sa.String(50), nullable=True),
        sa.Column("nombre", sa.String(200), nullable=True),
        sa.Column("parent_asset_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("model_id", sa.Integer(), sa.ForeignKey("models.id"), nullable=True),
        sa.Column("family_id", sa.Integer(), sa.ForeignKey("asset_families.id"), nullable=False),
        sa.Column("estado_id", sa.Integer(), sa.ForeignKey("asset_states.id"), nullable=False),
        sa.Column("ubicacion_id", sa.Integer(), sa.ForeignKey("ubicaciones.id"), nullable=True),
        sa.Column("stock_actual", sa.Numeric(12, 3), server_default="0"),
        sa.Column("stock_minimo", sa.Numeric(12, 3), server_default="0"),
        sa.Column("unidad", sa.String(10), server_default="unidad"),
        sa.Column("contenido_por_empaque", sa.Numeric(12, 3), nullable=True),
        sa.Column("nombre_empaque", sa.String(20), nullable=True),
        sa.Column("precio_compra", sa.Numeric(12, 2), nullable=True),
        sa.Column("valor_reposicion", sa.Numeric(12, 2), nullable=True),
        sa.Column("dias_max_prestamo", sa.Integer(), nullable=True),
        sa.Column("proxima_mantencion", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "uid_fisico", name="uq_assets_tenant_uid"),
    )
    op.alter_column(
        "inventory_logs", "variante_id", existing_type=sa.Integer(), nullable=True
    )
    op.add_column("inventory_logs", sa.Column("asset_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "inventory_logs_asset_id_fkey", "inventory_logs", "assets", ["asset_id"], ["id"]
    )
