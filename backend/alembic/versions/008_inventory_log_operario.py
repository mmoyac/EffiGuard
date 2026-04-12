"""Agrega operario_id a inventory_logs para retiro de consumibles

Revision ID: 008
Revises: 007
Create Date: 2026-04-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_logs",
        sa.Column("operario_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inventory_logs", "operario_id")
