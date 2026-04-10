"""Seeds: roles, estados, módulos y menú base

Revision ID: 002
Revises: 001
Create Date: 2026-04-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Roles
    conn.execute(sa.text("""
        INSERT INTO roles (nombre, descripcion) VALUES
        ('super_admin', 'Acceso total al sistema'),
        ('admin', 'Administrador del tenant'),
        ('bodeguero', 'Gestiona entregas y devoluciones'),
        ('operario', 'Recibe y devuelve herramientas')
    """))

    # Estados de activo
    conn.execute(sa.text("""
        INSERT INTO asset_states (nombre) VALUES
        ('Disponible'),
        ('En Terreno'),
        ('En Reparación'),
        ('Robado')
    """))

    # Módulos
    conn.execute(sa.text("""
        INSERT INTO modules (nombre, icono, orden) VALUES
        ('Dashboard', 'LayoutDashboard', 1),
        ('Activos', 'Package', 2),
        ('Préstamos', 'ArrowLeftRight', 3),
        ('Inventario', 'ClipboardList', 4),
        ('Usuarios', 'Users', 5),
        ('Proyectos', 'FolderOpen', 6)
    """))

    # Menu items (rutas base)
    conn.execute(sa.text("""
        INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) VALUES
        (1, NULL, 'Dashboard', '/', 'LayoutDashboard', 1),
        (2, NULL, 'Activos', '/assets', 'Package', 2),
        (2, NULL, 'Escanear', '/assets/scan', 'ScanLine', 3),
        (3, NULL, 'Préstamos Activos', '/loans', 'ArrowLeftRight', 4),
        (3, NULL, 'Consumibles', '/loans/consumables', 'Layers', 5),
        (4, NULL, 'Movimientos', '/inventory', 'ClipboardList', 6),
        (5, NULL, 'Usuarios', '/users', 'Users', 7),
        (6, NULL, 'Proyectos', '/projects', 'FolderOpen', 8)
    """))

    # Permisos por rol (super_admin y admin ven todo)
    conn.execute(sa.text("""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, m.id FROM roles r, menu_items m
        WHERE r.nombre IN ('super_admin', 'admin')
    """))

    # bodeguero: dashboard, activos, escanear, préstamos, consumibles, inventario
    conn.execute(sa.text("""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, m.id FROM roles r, menu_items m
        WHERE r.nombre = 'bodeguero'
        AND m.ruta IN ('/', '/assets', '/assets/scan', '/loans', '/loans/consumables', '/inventory')
    """))

    # operario: solo dashboard y escanear
    conn.execute(sa.text("""
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        SELECT r.id, m.id FROM roles r, menu_items m
        WHERE r.nombre = 'operario'
        AND m.ruta IN ('/', '/assets/scan')
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM role_menu_permissions"))
    conn.execute(sa.text("DELETE FROM menu_items"))
    conn.execute(sa.text("DELETE FROM modules"))
    conn.execute(sa.text("DELETE FROM asset_states"))
    conn.execute(sa.text("DELETE FROM roles"))
