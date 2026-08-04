"""Catálogo producto → variante → unidad, con códigos múltiples y proveedores

Revision ID: 020
Revises: 019
Create Date: 2026-08-03

ADITIVA a propósito. Crea el catálogo nuevo y deja `assets` y `models` en pie:
préstamos, escaneo, inventario y dashboard siguen operando sobre el catálogo
viejo mientras se prueba la carga del nuevo. La migración del resto y el drop de
`assets` van en un tramo posterior.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── proveedores ──────────────────────────────────────────────────────────
    op.create_table(
        "proveedores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("rut", sa.String(20), nullable=True),
        sa.Column("contacto", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "nombre", name="uq_proveedores_tenant_nombre"),
    )
    op.create_index("ix_proveedores_tenant_id", "proveedores", ["tenant_id"])

    # ── productos ────────────────────────────────────────────────────────────
    op.create_table(
        "productos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("family_id", sa.Integer(), sa.ForeignKey("asset_families.id"), nullable=False),
        sa.Column("brand_id", sa.Integer(), sa.ForeignKey("brands.id"), nullable=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "nombre", name="uq_productos_tenant_nombre"),
    )
    op.create_index("ix_productos_tenant_id", "productos", ["tenant_id"])

    # ── variantes ────────────────────────────────────────────────────────────
    op.create_table(
        "variantes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(
            "producto_id",
            sa.Integer(),
            sa.ForeignKey("productos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("atributos", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("unidad", sa.String(10), nullable=False, server_default="unidad"),
        sa.Column("stock_actual", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("stock_minimo", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("precio_compra", sa.Numeric(12, 2), nullable=True),
        sa.Column("valor_reposicion", sa.Numeric(12, 2), nullable=True),
        sa.Column("dias_max_prestamo", sa.Integer(), nullable=True),
        sa.Column("ubicacion_id", sa.Integer(), sa.ForeignKey("ubicaciones.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("producto_id", "nombre", name="uq_variantes_producto_nombre"),
    )
    op.create_index("ix_variantes_tenant_id", "variantes", ["tenant_id"])
    op.create_index("ix_variantes_producto_id", "variantes", ["producto_id"])
    # Filtro por atributo: ?atributo=material:zincado
    op.create_index(
        "ix_variantes_atributos", "variantes", ["atributos"], postgresql_using="gin"
    )

    # ── unidades ─────────────────────────────────────────────────────────────
    op.create_table(
        "unidades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(
            "variante_id",
            sa.Integer(),
            sa.ForeignKey("variantes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("estado_id", sa.Integer(), sa.ForeignKey("asset_states.id"), nullable=False),
        sa.Column("ubicacion_id", sa.Integer(), sa.ForeignKey("ubicaciones.id"), nullable=True),
        sa.Column("parent_unidad_id", sa.Integer(), sa.ForeignKey("unidades.id"), nullable=True),
        sa.Column("proxima_mantencion", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_unidades_tenant_id", "unidades", ["tenant_id"])
    op.create_index("ix_unidades_variante_id", "unidades", ["variante_id"])

    # ── codigos ──────────────────────────────────────────────────────────────
    op.create_table(
        "codigos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column(
            "variante_id",
            sa.Integer(),
            sa.ForeignKey("variantes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "unidad_id",
            sa.Integer(),
            sa.ForeignKey("unidades.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("codigo", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("proveedor_id", sa.Integer(), sa.ForeignKey("proveedores.id"), nullable=True),
        sa.Column("factor", sa.Numeric(12, 3), nullable=False, server_default="1"),
        sa.Column("nombre_empaque", sa.String(20), nullable=True),
        sa.Column("es_principal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Unicidad por tenant, no global: dos clientes que le compran a la misma
        # marca comparten el EAN de fábrica y chocarían siempre.
        sa.UniqueConstraint("tenant_id", "codigo", name="uq_codigos_tenant_codigo"),
        sa.CheckConstraint(
            "(variante_id IS NOT NULL AND unidad_id IS NULL) "
            "OR (variante_id IS NULL AND unidad_id IS NOT NULL)",
            name="ck_codigos_un_solo_dueno",
        ),
        sa.CheckConstraint("factor > 0", name="ck_codigos_factor_positivo"),
    )
    op.create_index("ix_codigos_tenant_id", "codigos", ["tenant_id"])
    op.create_index("ix_codigos_variante_id", "codigos", ["variante_id"])
    op.create_index("ix_codigos_unidad_id", "codigos", ["unidad_id"])
    # A lo más un principal por dueño. Parciales: los no-principales son muchos.
    op.create_index(
        "uq_codigos_principal_variante",
        "codigos",
        ["variante_id"],
        unique=True,
        postgresql_where=sa.text("es_principal AND variante_id IS NOT NULL"),
    )
    op.create_index(
        "uq_codigos_principal_unidad",
        "codigos",
        ["unidad_id"],
        unique=True,
        postgresql_where=sa.text("es_principal AND unidad_id IS NOT NULL"),
    )

    # ── inventory_logs: convivencia de los dos catálogos ─────────────────────
    # `asset_id` pasa a nullable para que un movimiento del catálogo nuevo (el
    # saldo de apertura de la importación) no tenga que inventar un activo viejo.
    op.alter_column("inventory_logs", "asset_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("inventory_logs", sa.Column("variante_id", sa.Integer(), nullable=True))
    op.add_column("inventory_logs", sa.Column("unidad_id", sa.Integer(), nullable=True))
    op.add_column("inventory_logs", sa.Column("codigo_id", sa.Integer(), nullable=True))
    op.add_column("inventory_logs", sa.Column("proveedor_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_inventory_logs_variante", "inventory_logs", "variantes", ["variante_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_inventory_logs_unidad", "inventory_logs", "unidades", ["unidad_id"], ["id"]
    )
    # SET NULL y no RESTRICT: borrar un código o un proveedor no debe invalidar un
    # movimiento ya ocurrido; sólo se pierde esa referencia.
    op.create_foreign_key(
        "fk_inventory_logs_codigo", "inventory_logs", "codigos", ["codigo_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_inventory_logs_proveedor", "inventory_logs", "proveedores", ["proveedor_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_inventory_logs_variante_id", "inventory_logs", ["variante_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_logs_variante_id", table_name="inventory_logs")
    op.drop_constraint("fk_inventory_logs_proveedor", "inventory_logs", type_="foreignkey")
    op.drop_constraint("fk_inventory_logs_codigo", "inventory_logs", type_="foreignkey")
    op.drop_constraint("fk_inventory_logs_unidad", "inventory_logs", type_="foreignkey")
    op.drop_constraint("fk_inventory_logs_variante", "inventory_logs", type_="foreignkey")
    op.drop_column("inventory_logs", "proveedor_id")
    op.drop_column("inventory_logs", "codigo_id")
    op.drop_column("inventory_logs", "unidad_id")
    op.drop_column("inventory_logs", "variante_id")

    # Los movimientos del catálogo nuevo no tienen asset_id: sin ellos la columna
    # no puede volver a NOT NULL, así que se eliminan. Es la contrapartida de que
    # la migración sea reversible, y sólo afecta a datos creados por este tramo.
    op.execute("DELETE FROM inventory_logs WHERE asset_id IS NULL")
    op.alter_column("inventory_logs", "asset_id", existing_type=sa.Integer(), nullable=False)

    op.drop_table("codigos")
    op.drop_table("unidades")
    op.drop_table("variantes")
    op.drop_table("productos")
    op.drop_table("proveedores")
