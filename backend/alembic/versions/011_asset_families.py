"""Reemplaza campo tipo (hardcoded) por tabla asset_families por tenant

Revision ID: 011
Revises: 010
Create Date: 2026-04-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Crear tabla asset_families
    op.create_table(
        "asset_families",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("comportamiento", sa.String(20), nullable=False),  # prestable | consumible
    )
    op.create_index("ix_asset_families_tenant_id", "asset_families", ["tenant_id"])

    # 2. Insertar familias por defecto para cada tenant existente
    conn.execute(sa.text("""
        INSERT INTO asset_families (tenant_id, nombre, comportamiento)
        SELECT id, 'Herramienta', 'prestable' FROM tenants
    """))
    conn.execute(sa.text("""
        INSERT INTO asset_families (tenant_id, nombre, comportamiento)
        SELECT id, 'Consumible', 'consumible' FROM tenants
    """))

    # 3. Agregar columna family_id (nullable por ahora para poder poblarla)
    op.add_column("assets", sa.Column("family_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_assets_family_id", "assets", "asset_families", ["family_id"], ["id"]
    )

    # 4. Migrar datos: tipo='herramienta' → familia 'Herramienta' (prestable)
    conn.execute(sa.text("""
        UPDATE assets
        SET family_id = (
            SELECT af.id FROM asset_families af
            WHERE af.tenant_id = assets.tenant_id
            AND af.comportamiento = 'prestable'
        )
        WHERE tipo = 'herramienta'
    """))

    # 5. Migrar datos: tipo='consumible' → familia 'Consumible' (consumible)
    conn.execute(sa.text("""
        UPDATE assets
        SET family_id = (
            SELECT af.id FROM asset_families af
            WHERE af.tenant_id = assets.tenant_id
            AND af.comportamiento = 'consumible'
        )
        WHERE tipo = 'consumible'
    """))

    # 6. Hacer NOT NULL
    op.alter_column("assets", "family_id", nullable=False)

    # 7. Eliminar columna tipo
    op.drop_column("assets", "tipo")


def downgrade() -> None:
    conn = op.get_bind()

    # Restaurar columna tipo
    op.add_column("assets", sa.Column("tipo", sa.String(20), nullable=True))

    # Recuperar tipo a partir del comportamiento de la familia
    conn.execute(sa.text("""
        UPDATE assets
        SET tipo = (
            SELECT CASE af.comportamiento
                WHEN 'prestable' THEN 'herramienta'
                WHEN 'consumible' THEN 'consumible'
                ELSE 'herramienta'
            END
            FROM asset_families af WHERE af.id = assets.family_id
        )
    """))

    op.alter_column("assets", "tipo", nullable=False)

    # Eliminar family_id
    op.drop_constraint("fk_assets_family_id", "assets", type_="foreignkey")
    op.drop_column("assets", "family_id")

    # Eliminar tabla
    op.drop_index("ix_asset_families_tenant_id", "asset_families")
    op.drop_table("asset_families")
