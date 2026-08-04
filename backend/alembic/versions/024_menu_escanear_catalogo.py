"""Reapunta el ítem "Escanear" al escáner del catálogo nuevo

Revision ID: 024
Revises: 023
Create Date: 2026-08-03

`/assets/scan` resuelve contra la tabla `assets`, así que con el catálogo nuevo
en uso devolvía "Activo no encontrado" para todo — incluidos los códigos que el
usuario acababa de cargar. Se reapunta la misma entrada de menú en vez de agregar
una segunda: dos escáneres en la barra lateral es exactamente la confusión que
ya provocaron los dos importadores.

La ruta vieja sigue existiendo en el frontend y se accede por URL.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA_VIEJA = "/assets/scan"
RUTA_NUEVA = "/catalogo/scan"


def upgrade() -> None:
    op.get_bind().execute(
        sa.text("UPDATE menu_items SET ruta = :nueva WHERE ruta = :vieja"),
        {"nueva": RUTA_NUEVA, "vieja": RUTA_VIEJA},
    )


def downgrade() -> None:
    op.get_bind().execute(
        sa.text("UPDATE menu_items SET ruta = :vieja WHERE ruta = :nueva"),
        {"nueva": RUTA_NUEVA, "vieja": RUTA_VIEJA},
    )
