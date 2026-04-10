"""Agrega módulo y menú items para Super Admin

Revision ID: 004
Revises: 003
Create Date: 2026-04-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Módulo Administración Global
    conn.execute(sa.text(
        "INSERT INTO modules (nombre, icono, orden) VALUES ('Administración', 'ShieldCheck', 99)"
    ))
    mod_id = conn.execute(sa.text(
        "SELECT id FROM modules WHERE nombre = 'Administración'"
    )).scalar()

    # Ítems de menú admin
    conn.execute(sa.text(f"""
        INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) VALUES
        ({mod_id}, NULL, 'Tenants',       '/admin/tenants',      'Building2',    101),
        ({mod_id}, NULL, 'Usuarios Global','/admin/users',        'UsersRound',   102),
        ({mod_id}, NULL, 'Estados Activo', '/admin/asset-states', 'Tag',          103),
        ({mod_id}, NULL, 'Módulos',        '/admin/modules',      'LayoutList',   104),
        ({mod_id}, NULL, 'Ítems Menú',     '/admin/menu-items',   'Menu',         105),
        ({mod_id}, NULL, 'Permisos',       '/admin/permissions',  'KeyRound',     106)
    """))

    # Permisos solo para super_admin (role_id = 1)
    conn.execute(sa.text("""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, m.id FROM roles r, menu_items m
        WHERE r.nombre = 'super_admin'
        AND m.ruta IN (
            '/admin/tenants', '/admin/users', '/admin/asset-states',
            '/admin/modules', '/admin/menu-items', '/admin/permissions'
        )
        ON CONFLICT DO NOTHING
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM role_menu_permissions
        WHERE menu_item_id IN (
            SELECT id FROM menu_items WHERE ruta LIKE '/admin/%'
        )
    """))
    conn.execute(sa.text("DELETE FROM menu_items WHERE ruta LIKE '/admin/%'"))
    conn.execute(sa.text("DELETE FROM modules WHERE nombre = 'Administración'"))
