"""Código de barras de fábrica y unicidad de uid_fisico por tenant

Revision ID: 017
Revises: 016
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # El código de fábrica identifica el PRODUCTO, no la unidad: las tres unidades
    # del mismo atornillador lo comparten. Por eso el índice NO es único.
    op.add_column("assets", sa.Column("codigo_fabricante", sa.String(50), nullable=True))
    op.create_index("ix_assets_codigo_fabricante", "assets", ["codigo_fabricante"])

    # uid_fisico deja de ser único global y pasa a serlo por tenant. Con códigos
    # propios generados por EffiGuard la unicidad global era inofensiva; con EAN de
    # fabricante es un defecto, porque el primer cliente que registre un código se
    # lo quita a todos los demás.
    op.drop_constraint("assets_uid_fisico_key", "assets", type_="unique")
    op.create_unique_constraint("uq_assets_tenant_uid", "assets", ["tenant_id", "uid_fisico"])


def downgrade() -> None:
    # Recrear la constraint global falla si dos tenants comparten un uid_fisico.
    # Hay que resolver esos duplicados a mano antes de revertir.
    op.drop_constraint("uq_assets_tenant_uid", "assets", type_="unique")
    op.create_unique_constraint("assets_uid_fisico_key", "assets", ["uid_fisico"])

    op.drop_index("ix_assets_codigo_fabricante", table_name="assets")
    op.drop_column("assets", "codigo_fabricante")
