"""Agrega campo color a asset_families

Revision ID: 012
Revises: 011
Create Date: 2026-04-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    op.add_column("asset_families", sa.Column("color", sa.String(20), nullable=True))

    # Valores por defecto según comportamiento
    conn.execute(sa.text(
        "UPDATE asset_families SET color = 'blue' WHERE comportamiento = 'prestable'"
    ))
    conn.execute(sa.text(
        "UPDATE asset_families SET color = 'orange' WHERE comportamiento = 'consumible'"
    ))

    op.alter_column("asset_families", "color", nullable=False)


def downgrade() -> None:
    op.drop_column("asset_families", "color")
