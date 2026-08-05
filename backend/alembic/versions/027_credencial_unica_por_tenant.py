"""La credencial es única por tenant, no global

Revision ID: 027
Revises: 026
Create Date: 2026-08-05

`users.uid_credencial` era la última columna de negocio con unicidad global, y
venía así desde la migración inicial. La tarjeta Bip! es nominativa del
trabajador, no de la empresa: el mismo maestro puede prestar servicios a dos
empresas del sistema, y con la restricción global la segunda no podía
registrarlo.

No hace falta sanear datos antes: como la restricción global rigió desde el
inicio, la base no puede contener duplicados cross-tenant. Se pasa de una regla
estricta a una más laxa, y eso nunca encuentra filas en conflicto.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("users_uid_credencial_key", "users", type_="unique")
    op.create_unique_constraint(
        "uq_users_tenant_credencial", "users", ["tenant_id", "uid_credencial"]
    )


def downgrade() -> None:
    # Revertir puede fallar, y debe: si para entonces dos tenants comparten una
    # tarjeta, restaurar la unicidad global encuentra un duplicado real. La
    # alternativa —borrar una de las dos credenciales para que el downgrade
    # pase— destruiría datos de un tenant para satisfacer a otro.
    op.drop_constraint("uq_users_tenant_credencial", "users", type_="unique")
    op.create_unique_constraint("users_uid_credencial_key", "users", ["uid_credencial"])
