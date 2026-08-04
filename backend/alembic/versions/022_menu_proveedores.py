"""Ítem de menú para la mantención de proveedores

Revision ID: 022
Revises: 021
Create Date: 2026-08-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA = "/proveedores"

# Mismo conjunto que Catálogo y Ubicaciones: el operario no mantiene catálogo.
ROLES = ("super_admin", "admin", "bodeguero")


def upgrade() -> None:
    conn = op.get_bind()

    module_id = conn.execute(sa.text("SELECT id FROM modules WHERE nombre = 'Activos'")).scalar()

    orden = conn.execute(
        sa.text("SELECT COALESCE(MAX(orden), 0) + 1 FROM menu_items WHERE module_id = :m"),
        {"m": module_id},
    ).scalar()

    conn.execute(
        sa.text(
            "INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) "
            "VALUES (:module_id, NULL, 'Proveedores', :ruta, 'Truck', :orden)"
        ),
        {"module_id": module_id, "ruta": RUTA, "orden": orden},
    )

    item_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": RUTA}
    ).scalar()

    conn.execute(
        sa.text(
            "INSERT INTO role_menu_permissions (role_id, menu_item_id) "
            "SELECT r.id, :item_id FROM roles r WHERE r.nombre = ANY(:roles) "
            "ON CONFLICT DO NOTHING"
        ),
        {"item_id": item_id, "roles": list(ROLES)},
    )


def downgrade() -> None:
    conn = op.get_bind()
    item_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": RUTA}
    ).scalar()
    if item_id:
        conn.execute(
            sa.text("DELETE FROM role_menu_permissions WHERE menu_item_id = :item_id"),
            {"item_id": item_id},
        )
        conn.execute(sa.text("DELETE FROM menu_items WHERE id = :item_id"), {"item_id": item_id})
