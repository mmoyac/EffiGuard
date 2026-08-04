"""Los préstamos pasan a referenciar unidades en vez de activos

Revision ID: 025
Revises: 024
Create Date: 2026-08-03

Se presta un EJEMPLAR, no un modelo. Con el catálogo nuevo el ejemplar es una
fila de `unidades`, así que `loans.asset_id` deja de tener a qué apuntar.

No hay backfill: los préstamos del catálogo viejo se eliminan. Es aceptable
porque `assets` ya está vacía —el catálogo se migró a productos y variantes— y
un préstamo sin activo no significa nada. Si hubiera préstamos abiertos, esta
migración fallaría antes de tocar nada.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Un préstamo abierto es material en manos de alguien: perderlo en silencio
    # sería exactamente lo que este sistema existe para evitar.
    abiertos = conn.execute(
        sa.text("SELECT count(*) FROM loans WHERE fecha_devolucion_real IS NULL")
    ).scalar()
    if abiertos:
        raise RuntimeError(
            f"Hay {abiertos} préstamo(s) abierto(s) en el catálogo viejo. "
            "Ciérrelos antes de migrar: no se pueden reasignar a una unidad automáticamente."
        )

    conn.execute(sa.text("DELETE FROM loans"))

    op.drop_column("loans", "asset_id")
    op.add_column("loans", sa.Column("unidad_id", sa.Integer(), nullable=False))
    op.create_foreign_key("fk_loans_unidad", "loans", "unidades", ["unidad_id"], ["id"])
    op.create_index("ix_loans_unidad_id", "loans", ["unidad_id"])


def downgrade() -> None:
    # Los préstamos sobre unidades no tienen activo al que volver.
    op.get_bind().execute(sa.text("DELETE FROM loans"))
    op.drop_index("ix_loans_unidad_id", table_name="loans")
    op.drop_constraint("fk_loans_unidad", "loans", type_="foreignkey")
    op.drop_column("loans", "unidad_id")
    op.add_column("loans", sa.Column("asset_id", sa.Integer(), nullable=False))
    op.create_foreign_key("loans_asset_id_fkey", "loans", "assets", ["asset_id"], ["id"])
