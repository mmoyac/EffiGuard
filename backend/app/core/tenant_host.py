"""Resolución del tenant a partir del host de la petición.

Vive en `core/` y no en `services/auth.py` porque derivar el tenant del
subdominio es infraestructura, no una regla de login: el manifiesto PWA lo
necesita sin que haya sesión.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.tenant import Tenant

# effiguard-{slug}.effi4tech.cl  →  grupo 1 = slug
SLUG_RE = re.compile(rf"^effiguard-([^.]+)\.{re.escape(settings.BASE_DOMAIN)}(?::\d+)?$")


def extract_slug(host: str) -> str | None:
    """Slug del subdominio, o None si el host no es de un tenant."""
    m = SLUG_RE.match(host)
    return m.group(1) if m else None


async def resolve_tenant_optional(host: str, session: AsyncSession) -> Tenant | None:
    """Tenant activo del host, o None.

    A diferencia de la resolución del login, aquí un host desconocido no es un
    error: el dominio base y los tenants desactivados degradan a la identidad
    genérica de EffiGuard.
    """
    slug = extract_slug(host)
    if not slug:
        return None

    result = await session.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
    )
    return result.scalar_one_or_none()
