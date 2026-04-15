"""Agrega dias_max_prestamo a asset_families (default) y assets (override)

Revision ID: 013
Revises: 012
Create Date: 2026-04-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Default en la familia (nullable = sin límite)
    op.add_column("asset_families", sa.Column("dias_max_prestamo", sa.Integer(), nullable=True))
    # Override por activo (nullable = usa el de la familia)
    op.add_column("assets", sa.Column("dias_max_prestamo", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("assets", "dias_max_prestamo")
    op.drop_column("asset_families", "dias_max_prestamo")
