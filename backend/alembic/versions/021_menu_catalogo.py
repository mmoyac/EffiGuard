"""Ítem de menú para el catálogo producto → variante → unidad

Revision ID: 021
Revises: 020
Create Date: 2026-08-03

Va aparte de la 020 porque es una decisión distinta: la 020 crea el esquema, ésta
lo hace alcanzable desde la interfaz. Mientras dure la convivencia, el menú
muestra las dos entradas — "Activos" (catálogo viejo, con préstamos y escaneo) y
"Catálogo" (el nuevo, con la carga) — y la vieja se retira en el tramo siguiente.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA = "/catalogo"

# Mismo conjunto que ya accede a /assets y /ubicaciones: el operario no mantiene
# catálogo, sólo retira y devuelve.
ROLES = ("super_admin", "admin", "bodeguero")


def upgrade() -> None:
    conn = op.get_bind()

    module_id = conn.execute(sa.text("SELECT id FROM modules WHERE nombre = 'Activos'")).scalar()

    # Al final del módulo Activos, para no reordenar lo que el usuario ya conoce.
    orden = conn.execute(
        sa.text("SELECT COALESCE(MAX(orden), 0) + 1 FROM menu_items WHERE module_id = :m"),
        {"m": module_id},
    ).scalar()

    conn.execute(
        sa.text(
            "INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) "
            "VALUES (:module_id, NULL, 'Catálogo', :ruta, 'Boxes', :orden)"
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
