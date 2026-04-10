"""Demo data: tenant, usuarios, marcas, modelos y activos de prueba

Revision ID: 003
Revises: 002
Create Date: 2026-04-09

Credenciales de acceso:
  super_admin : admin@effiguard.com  / Admin1234!
  bodeguero   : bodega@demo.com      / Bodega123!
  operario    : operario@demo.com    / Operario1!

UIDs para probar el scanner:
  Herramienta  : QR-TALADRO-001
  Consumible   : QR-DISCO-STOCK
  Kit (padre)  : QR-KIT-AMOLADORA-PADRE
"""
from typing import Sequence, Union

import bcrypt as _bcrypt
import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(12)).decode()


def upgrade() -> None:
    conn = op.get_bind()

    h_admin  = _hash("Admin1234!")
    h_bodega = _hash("Bodega123!")
    h_oper   = _hash("Operario1!")

    # ── Tenant demo ──────────────────────────────────────────────────────────
    conn.execute(sa.text(
        "INSERT INTO tenants (nombre_empresa, rut_empresa, slug, plan_type) "
        "VALUES ('Empresa Demo', '76.000.001-1', 'demo', 'pro')"
    ))
    tenant_id = conn.execute(sa.text("SELECT id FROM tenants WHERE slug = 'demo'")).scalar()

    # ── Usuarios ─────────────────────────────────────────────────────────────
    # role IDs según seed 002: 1=super_admin, 2=admin, 3=bodeguero, 4=operario
    conn.execute(sa.text(
        "INSERT INTO users (tenant_id, role_id, rut, nombre, email, password_hash, uid_credencial) VALUES "
        f"({tenant_id}, 1, '11.111.111-1', 'Super Admin',   'admin@effiguard.com', :h_admin,  'RFID-ADMIN-001'),"
        f"({tenant_id}, 3, '22.222.222-2', 'Juan Bodeguero','bodega@demo.com',     :h_bodega, 'RFID-BODEGA-001'),"
        f"({tenant_id}, 4, '33.333.333-3', 'Pedro Operario','operario@demo.com',   :h_oper,   'RFID-OPER-001')"
    ), {"h_admin": h_admin, "h_bodega": h_bodega, "h_oper": h_oper})

    # ── Marca y modelos de prueba ─────────────────────────────────────────────
    conn.execute(sa.text(
        f"INSERT INTO brands (tenant_id, nombre) VALUES ({tenant_id}, 'DeWalt')"
    ))
    brand_id = conn.execute(sa.text(
        f"SELECT id FROM brands WHERE tenant_id = {tenant_id} AND nombre = 'DeWalt'"
    )).scalar()

    conn.execute(sa.text(
        f"INSERT INTO models (tenant_id, brand_id, nombre) VALUES "
        f"({tenant_id}, {brand_id}, 'Taladro DCD777'),"
        f"({tenant_id}, {brand_id}, 'Amoladora DWE402'),"
        f"({tenant_id}, {brand_id}, 'Disco de Corte 115mm')"
    ))

    m_taladro   = conn.execute(sa.text("SELECT id FROM models WHERE nombre = 'Taladro DCD777'")).scalar()
    m_amoladora = conn.execute(sa.text("SELECT id FROM models WHERE nombre = 'Amoladora DWE402'")).scalar()
    m_disco     = conn.execute(sa.text("SELECT id FROM models WHERE nombre = 'Disco de Corte 115mm'")).scalar()

    # ── Activos simples ───────────────────────────────────────────────────────
    # estado_id 1 = Disponible (seed 002)
    conn.execute(sa.text(
        f"INSERT INTO assets (tenant_id, uid_fisico, model_id, tipo, estado_id, stock_actual, stock_minimo, valor_reposicion) VALUES "
        f"({tenant_id}, 'QR-TALADRO-001',   {m_taladro},   'herramienta', 1, 1, 0, 150000),"
        f"({tenant_id}, 'QR-AMOLADORA-001', {m_amoladora}, 'herramienta', 1, 1, 0,  85000),"
        f"({tenant_id}, 'QR-DISCO-STOCK',   {m_disco},     'consumible',  1, 50, 10,  2500)"
    ))

    # ── Kit (padre + hijos) ───────────────────────────────────────────────────
    conn.execute(sa.text(
        f"INSERT INTO assets (tenant_id, uid_fisico, model_id, tipo, estado_id, stock_actual, stock_minimo, valor_reposicion) "
        f"VALUES ({tenant_id}, 'QR-KIT-AMOLADORA-PADRE', {m_amoladora}, 'herramienta', 1, 1, 0, 100000)"
    ))
    kit_id = conn.execute(sa.text(
        "SELECT id FROM assets WHERE uid_fisico = 'QR-KIT-AMOLADORA-PADRE'"
    )).scalar()

    conn.execute(sa.text(
        f"INSERT INTO assets (tenant_id, uid_fisico, parent_asset_id, model_id, tipo, estado_id, stock_actual, stock_minimo) VALUES "
        f"({tenant_id}, 'QR-KIT-DISCO-HIJO-1', {kit_id}, {m_disco},     'herramienta', 1, 1, 0),"
        f"({tenant_id}, 'QR-KIT-MALETIN',      {kit_id}, {m_amoladora}, 'herramienta', 1, 1, 0)"
    ))

    # ── Proyecto demo ─────────────────────────────────────────────────────────
    conn.execute(sa.text(
        f"INSERT INTO projects (tenant_id, nombre) VALUES ({tenant_id}, 'Obra Norte 2026')"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    tenant = conn.execute(sa.text("SELECT id FROM tenants WHERE slug = 'demo'")).scalar()
    if tenant:
        conn.execute(sa.text(f"DELETE FROM inventory_logs WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM loans         WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM assets        WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM projects      WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM models        WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM brands        WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM users         WHERE tenant_id = {tenant}"))
        conn.execute(sa.text(f"DELETE FROM tenants       WHERE id = {tenant}"))
