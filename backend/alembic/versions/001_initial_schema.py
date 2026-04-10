"""Initial schema - 14 tables

Revision ID: 001
Revises:
Create Date: 2026-04-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # tenants
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre_empresa", sa.String(200), nullable=False),
        sa.Column("rut_empresa", sa.String(20), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("plan_type", sa.String(20), server_default="basic"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # roles
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(50), nullable=False, unique=True),
        sa.Column("descripcion", sa.Text()),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("rut", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("uid_credencial", sa.String(100), unique=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
    )

    # modules
    op.create_table(
        "modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("icono", sa.String(50)),
        sa.Column("orden", sa.Integer(), server_default="0"),
    )

    # menu_items
    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("menu_items.id")),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("ruta", sa.String(200), nullable=False),
        sa.Column("icono", sa.String(50)),
        sa.Column("orden", sa.Integer(), server_default="0"),
    )

    # role_menu_permissions
    op.create_table(
        "role_menu_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("menu_item_id", sa.Integer(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.UniqueConstraint("role_id", "menu_item_id"),
    )

    # brands
    op.create_table(
        "brands",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
    )

    # models
    op.create_table(
        "models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("brand_id", sa.Integer(), sa.ForeignKey("brands.id"), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
    )

    # asset_states
    op.create_table(
        "asset_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(50), nullable=False, unique=True),
    )

    # projects
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
    )

    # assets
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("uid_fisico", sa.String(100), nullable=False, unique=True),
        sa.Column("parent_asset_id", sa.Integer(), sa.ForeignKey("assets.id")),
        sa.Column("model_id", sa.Integer(), sa.ForeignKey("models.id"), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("estado_id", sa.Integer(), sa.ForeignKey("asset_states.id"), nullable=False),
        sa.Column("stock_actual", sa.Integer(), server_default="0"),
        sa.Column("stock_minimo", sa.Integer(), server_default="0"),
        sa.Column("valor_reposicion", sa.Numeric(12, 2)),
        sa.Column("proxima_mantencion", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # loans
    op.create_table(
        "loans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("asset_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("bodeguero_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id")),
        sa.Column("fecha_entrega", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_devolucion_prevista", sa.DateTime(timezone=True)),
        sa.Column("fecha_devolucion_real", sa.DateTime(timezone=True)),
    )

    # inventory_logs
    op.create_table(
        "inventory_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("asset_id", sa.Integer(), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tipo_movimiento", sa.String(30), nullable=False),
        sa.Column("cantidad", sa.Integer(), server_default="1"),
        sa.Column("fecha_hora", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("observaciones", sa.Text()),
    )

    # subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("estado_pago", sa.String(20), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("inventory_logs")
    op.drop_table("loans")
    op.drop_table("assets")
    op.drop_table("projects")
    op.drop_table("asset_states")
    op.drop_table("models")
    op.drop_table("brands")
    op.drop_table("role_menu_permissions")
    op.drop_table("menu_items")
    op.drop_table("modules")
    op.drop_table("users")
    op.drop_table("roles")
    op.drop_table("tenants")
