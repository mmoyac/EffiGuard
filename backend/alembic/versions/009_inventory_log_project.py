"""Agrega project_id a inventory_logs para retiro de consumibles con proyecto

Revision ID: 009
Revises: 008
Create Date: 2026-04-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_logs",
        sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inventory_logs", "project_id")
