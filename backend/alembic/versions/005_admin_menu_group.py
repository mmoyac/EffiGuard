"""Agrupa ítems admin bajo un padre 'Administración' en el menú

Revision ID: 005
Revises: 004
Create Date: 2026-04-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADMIN_ROUTES = (
    "/admin/tenants", "/admin/users", "/admin/asset-states",
    "/admin/modules", "/admin/menu-items", "/admin/permissions",
)


def upgrade() -> None:
    conn = op.get_bind()

    mod_id = conn.execute(
        sa.text("SELECT id FROM modules WHERE nombre = 'Administración'")
    ).scalar()

    # Ítem padre (sin ruta = actúa como grupo colapsable)
    conn.execute(sa.text(
        f"INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) "
        f"VALUES ({mod_id}, NULL, 'Administración', '', 'ShieldCheck', 100)"
    ))
    parent_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = '' AND label = 'Administración'")
    ).scalar()

    # Apuntar hijos al padre
    routes = ", ".join(f"'{r}'" for r in ADMIN_ROUTES)
    conn.execute(sa.text(
        f"UPDATE menu_items SET parent_id = {parent_id} WHERE ruta IN ({routes})"
    ))

    # Permiso super_admin sobre el ítem padre
    conn.execute(sa.text(f"""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, {parent_id} FROM roles r
        WHERE r.nombre = 'super_admin'
        ON CONFLICT DO NOTHING
    """))


def downgrade() -> None:
    conn = op.get_bind()

    parent_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = '' AND label = 'Administración'")
    ).scalar()
    if not parent_id:
        return

    conn.execute(sa.text(
        f"UPDATE menu_items SET parent_id = NULL WHERE parent_id = {parent_id}"
    ))
    conn.execute(sa.text(
        f"DELETE FROM role_menu_permissions WHERE menu_item_id = {parent_id}"
    ))
    conn.execute(sa.text(f"DELETE FROM menu_items WHERE id = {parent_id}"))
