"""Contenido por empaque: comprar en cajas y despachar en unidades

Revision ID: 018
Revises: 017
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ambas nulas y sin backfill: los activos existentes siguen comprándose por
    # unidad, que es exactamente el comportamiento anterior.
    op.add_column("assets", sa.Column("contenido_por_empaque", sa.Numeric(12, 3), nullable=True))
    op.add_column("assets", sa.Column("nombre_empaque", sa.String(20), nullable=True))


def downgrade() -> None:
    # Las compras ya registradas conservan su cantidad en unidades de stock, que
    # es la correcta: sólo se pierde la configuración del empaque.
    op.drop_column("assets", "nombre_empaque")
    op.drop_column("assets", "contenido_por_empaque")
