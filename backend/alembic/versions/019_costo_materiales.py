"""Precio de compra del consumible y costo congelado en cada movimiento

Revision ID: 019
Revises: 018
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Costo de una unidad de stock. Opcional: sin precio, los movimientos quedan
    # sin valorizar y se reportan como tales, nunca como cero.
    op.add_column("assets", sa.Column("precio_compra", sa.Numeric(12, 2), nullable=True))

    # Sin backfill deliberado: no se sabía el precio cuando esos movimientos
    # ocurrieron, e inventarlo hacia atrás sería falsear la historia.
    op.add_column("inventory_logs", sa.Column("costo_unitario", sa.Numeric(12, 4), nullable=True))


def downgrade() -> None:
    # Se pierde la configuración de precios y los costos congelados.
    # Ningún dato de inventario se ve afectado.
    op.drop_column("inventory_logs", "costo_unitario")
    op.drop_column("assets", "precio_compra")
