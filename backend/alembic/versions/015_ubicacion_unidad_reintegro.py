"""Catálogo de ubicaciones, unidad de medida, stock decimal y origen de reintegro

Revision ID: 015
Revises: 014
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Catálogo de ubicaciones ───────────────────────────────────────────────
    op.create_table(
        "ubicaciones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("rack", sa.String(20), nullable=False),
        sa.Column("nivel", sa.String(20), nullable=False),
        sa.Column("posicion", sa.String(20), nullable=False),
        sa.Column("descripcion", sa.String(200), nullable=True),
        sa.UniqueConstraint("tenant_id", "rack", "nivel", "posicion", name="uq_ubicaciones_tenant_posicion"),
    )
    op.create_index("ix_ubicaciones_tenant_id", "ubicaciones", ["tenant_id"])

    # ── Activos: ubicación y unidad de medida ─────────────────────────────────
    op.add_column("assets", sa.Column("ubicacion_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_assets_ubicacion_id", "assets", "ubicaciones", ["ubicacion_id"], ["id"]
    )
    op.add_column(
        "assets",
        sa.Column("unidad", sa.String(10), nullable=False, server_default="unidad"),
    )

    # ── Cantidades decimales ──────────────────────────────────────────────────
    # Los consumibles que se miden (metros, kilos) no caben en un entero.
    op.alter_column(
        "assets", "stock_actual",
        type_=sa.Numeric(12, 3), existing_type=sa.Integer(),
        postgresql_using="stock_actual::numeric(12,3)",
    )
    op.alter_column(
        "assets", "stock_minimo",
        type_=sa.Numeric(12, 3), existing_type=sa.Integer(),
        postgresql_using="stock_minimo::numeric(12,3)",
    )
    op.alter_column(
        "inventory_logs", "cantidad",
        type_=sa.Numeric(12, 3), existing_type=sa.Integer(),
        postgresql_using="cantidad::numeric(12,3)",
    )

    # ── Origen del reintegro ──────────────────────────────────────────────────
    # Un reintegro apunta al despacho del que vuelve el material, lo que permite
    # validar el saldo y calcular el consumo neto por proyecto.
    op.add_column("inventory_logs", sa.Column("origen_log_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_inventory_logs_origen_log_id", "inventory_logs", "inventory_logs", ["origen_log_id"], ["id"]
    )
    op.create_index("ix_inventory_logs_origen_log_id", "inventory_logs", ["origen_log_id"])


def downgrade() -> None:
    # DESTRUCTIVO: revertir el tipo numérico redondea y pierde los decimales
    # registrados, y borrar origen_log_id deja los reintegros sin su despacho.
    op.drop_index("ix_inventory_logs_origen_log_id", table_name="inventory_logs")
    op.drop_constraint("fk_inventory_logs_origen_log_id", "inventory_logs", type_="foreignkey")
    op.drop_column("inventory_logs", "origen_log_id")

    op.alter_column(
        "inventory_logs", "cantidad",
        type_=sa.Integer(), existing_type=sa.Numeric(12, 3),
        postgresql_using="ROUND(cantidad)::integer",
    )
    op.alter_column(
        "assets", "stock_minimo",
        type_=sa.Integer(), existing_type=sa.Numeric(12, 3),
        postgresql_using="ROUND(stock_minimo)::integer",
    )
    op.alter_column(
        "assets", "stock_actual",
        type_=sa.Integer(), existing_type=sa.Numeric(12, 3),
        postgresql_using="ROUND(stock_actual)::integer",
    )

    op.drop_column("assets", "unidad")
    op.drop_constraint("fk_assets_ubicacion_id", "assets", type_="foreignkey")
    op.drop_column("assets", "ubicacion_id")

    op.drop_index("ix_ubicaciones_tenant_id", table_name="ubicaciones")
    op.drop_table("ubicaciones")
