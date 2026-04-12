from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.core.dependencies import DBSession
from app.models.tenant import Tenant

router = APIRouter(prefix="/pwa", tags=["PWA"])

_BASE_ICONS = [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
]


@router.get("/manifest/{tenant_id}")
async def pwa_manifest(tenant_id: int, session: DBSession) -> JSONResponse:
    """Manifest dinámico por tenant — sin auth, el nombre de empresa no es dato sensible."""
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()

    if tenant:
        name = f"EffiGuard · {tenant.nombre_empresa}"
        short_name = tenant.nombre_empresa[:12]  # Android limita ~12 chars bajo el ícono
    else:
        name = "EffiGuard"
        short_name = "EffiGuard"

    manifest = {
        "name": name,
        "short_name": short_name,
        "description": "Gestión de activos y control de bodega",
        "theme_color": "#111827",
        "background_color": "#111827",
        "display": "standalone",
        "orientation": "portrait",
        "start_url": "/",
        "scope": "/",
        "icons": _BASE_ICONS,
    }

    return JSONResponse(
        content=manifest,
        headers={
            "Content-Type": "application/manifest+json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
