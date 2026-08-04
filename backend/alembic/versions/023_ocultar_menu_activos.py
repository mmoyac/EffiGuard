"""Oculta el ítem de menú del catálogo viejo (/assets)

Revision ID: 023
Revises: 022
Create Date: 2026-08-03

La página sigue existiendo y la ruta responde: lo que se retira son los permisos
de rol, que es de donde el menú lateral se construye. Con `assets` vacía esa
pantalla no sirve a nada y sólo compite con "Catálogo", que es la que carga.

Se quitan los permisos en vez de borrar el `menu_item` para que volver atrás no
dependa de una migración: basta re-otorgarlo desde Administración → Permisos.
El drop definitivo va con el tramo que migra préstamos y escaneo.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA = "/assets"
ROLES = ("super_admin", "admin", "bodeguero")


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM role_menu_permissions WHERE menu_item_id = "
            "(SELECT id FROM menu_items WHERE ruta = :ruta)"
        ),
        {"ruta": RUTA},
    )


def downgrade() -> None:
    conn = op.get_bind()
    item_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": RUTA}
    ).scalar()
    if item_id:
        conn.execute(
            sa.text(
                "INSERT INTO role_menu_permissions (role_id, menu_item_id) "
                "SELECT r.id, :item_id FROM roles r WHERE r.nombre = ANY(:roles) "
                "ON CONFLICT DO NOTHING"
            ),
            {"item_id": item_id, "roles": list(ROLES)},
        )
