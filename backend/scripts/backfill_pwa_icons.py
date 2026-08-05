"""Genera los íconos PWA derivados de los tenants que ya tenían logo cargado.

Los derivados se producen al subir el logo, así que los tenants dados de alta
antes de este change no los tienen. Sin ellos el manifiesto degrada al ícono
genérico, que es correcto pero no es lo que se quiere.

Idempotente: sólo lee `/static/logos/` y reescribe los derivados, no toca la
base de datos.

Uso:
    docker compose exec backend python -m scripts.backfill_pwa_icons
"""

import asyncio
import os
import sys

from sqlalchemy import select

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.services import pwa_icons  # noqa: E402

_LOGOS_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "logos")


async def main() -> int:
    generados, omitidos, fallidos = 0, 0, 0

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tenant).where(Tenant.logo_url.is_not(None)))
        tenants = result.scalars().all()

    if not tenants:
        print("No hay tenants con logo cargado.")
        return 0

    for tenant in tenants:
        logo_path = os.path.join(_LOGOS_DIR, tenant.logo_url.split("/")[-1])

        if not os.path.exists(logo_path):
            print(f"  ✗ {tenant.slug}: el archivo {tenant.logo_url} no está en disco")
            fallidos += 1
            continue

        hash8 = pwa_icons.hash_logo(logo_path)
        if pwa_icons.derivados_existen(tenant.slug, hash8):
            print(f"  · {tenant.slug}: ya tiene derivados ({hash8})")
            omitidos += 1
            continue

        if pwa_icons.generar_derivados(logo_path, tenant.slug):
            print(f"  ✓ {tenant.slug}: derivados generados ({hash8})")
            generados += 1
        else:
            print(f"  ✗ {tenant.slug}: no se pudo derivar (¿SVG?), queda con íconos genéricos")
            fallidos += 1

    print(f"\nGenerados: {generados} · Ya estaban: {omitidos} · Sin derivar: {fallidos}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
