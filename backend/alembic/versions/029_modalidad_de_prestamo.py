"""Modalidad de entrega del préstamo: por plazo o a cargo

Revision ID: 029
Revises: 028
Create Date: 2026-08-20

El bodeguero entrega de dos maneras y la tabla sólo conocía una. Está el préstamo
con plazo —"lo necesito el viernes"— y está la entrega a cargo: la galletera queda
con Pérez hasta nuevo aviso, él responde por ella, y nadie espera que la traiga.

Una columna y no la ausencia de `fecha_devolucion_prevista`: esa nulidad ya
significa "sin fecha pactada, rige el límite del catálogo", que es el caso más
común. Darle además el sentido de "a cargo" convertiría de golpe cada préstamo
corriente en una asignación indefinida.

Los préstamos existentes quedan en 'plazo', que es exactamente lo que eran.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "loans",
        sa.Column("modalidad", sa.String(10), nullable=False, server_default="plazo"),
    )


def downgrade() -> None:
    op.drop_column("loans", "modalidad")
