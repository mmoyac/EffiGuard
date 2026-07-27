"""Ítem de menú para la mantención del catálogo de ubicaciones

Revision ID: 016
Revises: 015
Create Date: 2026-07-27
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA = "/ubicaciones"

# Mismo conjunto de roles que ya accede a /assets y /assets/scan
ROLES = ("super_admin", "admin", "bodeguero")


def upgrade() -> None:
    conn = op.get_bind()

    # Liberar el orden 4 para que Ubicaciones quede junto al resto del módulo Activos
    # (2 Activos, 3 Escanear, 4 Ubicaciones). El slot 5 estaba libre.
    conn.execute(sa.text("UPDATE menu_items SET orden = 5 WHERE ruta = '/loans'"))

    module_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE nombre = 'Activos'")
    ).scalar()

    conn.execute(
        sa.text(
            "INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) "
            "VALUES (:module_id, NULL, 'Ubicaciones', :ruta, 'MapPin', 4)"
        ),
        {"module_id": module_id, "ruta": RUTA},
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

    conn.execute(sa.text("UPDATE menu_items SET orden = 4 WHERE ruta = '/loans'"))
