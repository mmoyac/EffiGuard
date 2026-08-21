"""Menú del operario: consulta de bodega y sus préstamos, sin escáner de despacho

Revision ID: 028
Revises: 027
Create Date: 2026-08-20

Tres correcciones que son la misma decisión: qué alcanza el rol operario.

"Mis Préstamos" nunca existió como `menu_item`. El operario llegaba ahí por un
redirect desde `/`, así que su menú le mostraba "Dashboard" apuntando a una
pantalla que no iba a ver nunca.

"Bodega" es nueva: la consulta de sólo lectura que responde si hay y dónde está.

Y se le retira "Escanear". Ese ítem le quedó al operario por arrastre: el seed
inicial le dio `/assets/scan` cuando el escáner viejo no despachaba nada, y la
migración 024 lo reapuntó a `/catalogo/scan` —que sí descuenta stock y crea
préstamos— sin revisar quién lo tenía. Despachar es gesto del bodeguero.

El seed 002 no se toca: ya corrió en todos los ambientes y editarlo no cambiaría
ninguna base existente.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RUTA_MIS_PRESTAMOS = "/my-loans"
RUTA_BODEGA = "/bodega"
RUTA_ESCANEAR = "/catalogo/scan"
RUTA_DASHBOARD = "/"

# La consulta de bodega le sirve también a quien atiende el mesón: es la misma
# pregunta. El super_admin ve todo por su propia migración.
ROLES_BODEGA = ("super_admin", "admin", "bodeguero", "operario")


def _module_id(conn, nombre: str) -> int:
    return conn.execute(
        sa.text("SELECT id FROM modules WHERE nombre = :n"), {"n": nombre}
    ).scalar()


def _siguiente_orden(conn, module_id: int) -> int:
    """Al final de su módulo, para no reordenar lo que el usuario ya conoce."""
    return conn.execute(
        sa.text("SELECT COALESCE(MAX(orden), 0) + 1 FROM menu_items WHERE module_id = :m"),
        {"m": module_id},
    ).scalar()


def _crear_item(conn, module_id: int, label: str, ruta: str, icono: str) -> int:
    conn.execute(
        sa.text(
            "INSERT INTO menu_items (module_id, parent_id, label, ruta, icono, orden) "
            "VALUES (:module_id, NULL, :label, :ruta, :icono, :orden)"
        ),
        {
            "module_id": module_id,
            "label": label,
            "ruta": ruta,
            "icono": icono,
            "orden": _siguiente_orden(conn, module_id),
        },
    )
    return conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": ruta}
    ).scalar()


def _otorgar(conn, item_id: int, roles: Sequence[str]) -> None:
    conn.execute(
        sa.text(
            "INSERT INTO role_menu_permissions (role_id, menu_item_id) "
            "SELECT r.id, :item_id FROM roles r WHERE r.nombre = ANY(:roles) "
            "ON CONFLICT DO NOTHING"
        ),
        {"item_id": item_id, "roles": list(roles)},
    )


def _borrar_item(conn, ruta: str) -> None:
    item_id = conn.execute(
        sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": ruta}
    ).scalar()
    if item_id:
        conn.execute(
            sa.text("DELETE FROM role_menu_permissions WHERE menu_item_id = :item_id"),
            {"item_id": item_id},
        )
        conn.execute(sa.text("DELETE FROM menu_items WHERE id = :item_id"), {"item_id": item_id})


def upgrade() -> None:
    conn = op.get_bind()

    mis_prestamos = _crear_item(
        conn, _module_id(conn, "Préstamos"), "Mis Préstamos", RUTA_MIS_PRESTAMOS, "ClipboardCheck"
    )
    _otorgar(conn, mis_prestamos, ("operario",))

    bodega = _crear_item(
        conn, _module_id(conn, "Inventario"), "Bodega", RUTA_BODEGA, "PackageSearch"
    )
    _otorgar(conn, bodega, ROLES_BODEGA)

    # Los ítems siguen existiendo para los demás roles: sólo se retira el permiso.
    # El Dashboard se va con el escáner: el operario entra a `/my-loans`, así que
    # su "Dashboard" apuntaba a una pantalla que el redirect nunca le muestra.
    for ruta in (RUTA_ESCANEAR, RUTA_DASHBOARD):
        conn.execute(
            sa.text(
                "DELETE FROM role_menu_permissions WHERE menu_item_id = "
                "(SELECT id FROM menu_items WHERE ruta = :ruta) "
                "AND role_id = (SELECT id FROM roles WHERE nombre = 'operario')"
            ),
            {"ruta": ruta},
        )


def downgrade() -> None:
    conn = op.get_bind()

    _borrar_item(conn, RUTA_BODEGA)
    _borrar_item(conn, RUTA_MIS_PRESTAMOS)

    for ruta in (RUTA_ESCANEAR, RUTA_DASHBOARD):
        item_id = conn.execute(
            sa.text("SELECT id FROM menu_items WHERE ruta = :ruta"), {"ruta": ruta}
        ).scalar()
        if item_id:
            _otorgar(conn, item_id, ("operario",))
