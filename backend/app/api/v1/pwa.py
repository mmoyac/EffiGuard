import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.dependencies import DBSession
from app.core.tenant_host import resolve_tenant_optional
from app.services import pwa_icons

router = APIRouter(prefix="/pwa", tags=["PWA"])

_LOGOS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "logos")

# Íconos genéricos de EffiGuard, servidos por el frontend desde /icons/.
# Son el fallback de todo: dominio base, tenant sin logo, derivados ausentes.
_ICONOS_GENERICOS = [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
]

_ICONO_GENERICO_APPLE = "/icons/icon-192.png"


def _hash_derivados(tenant) -> str | None:
    """Hash de los derivados del tenant, o None si no hay o no están completos."""
    if not tenant or not tenant.logo_url:
        return None

    logo_path = os.path.join(_LOGOS_DIR, tenant.logo_url.split("/")[-1])
    if not os.path.exists(logo_path):
        return None

    hash8 = pwa_icons.hash_logo(logo_path)
    return hash8 if pwa_icons.derivados_existen(tenant.slug, hash8) else None


def _iconos(tenant) -> list[dict]:
    """Íconos del tenant, degradando a los genéricos.

    `any` y `maskable` van en entradas separadas a propósito: fusionadas en un
    solo `"any maskable"`, Android aplica el recorte circular también al ícono
    plano y se come los bordes del logo.
    """
    hash8 = _hash_derivados(tenant)
    if not hash8:
        return _ICONOS_GENERICOS

    return [
        {
            "src": pwa_icons.url_derivado(tenant.slug, hash8, size, purpose),
            "sizes": f"{size}x{size}",
            "type": "image/png",
            "purpose": purpose,
        }
        for size in (192, 512)
        for purpose in ("any", "maskable")
    ]


@router.get("/manifest")
async def pwa_manifest(request: Request, session: DBSession) -> JSONResponse:
    """Manifiesto resuelto por subdominio, sin auth.

    Sin autenticación a propósito: el navegador lo pide en la primera carga,
    antes de cualquier login, y ese es justamente el momento en que aparece el
    prompt de instalación. El nombre de empresa no es dato sensible.
    """
    tenant = await resolve_tenant_optional(request.headers.get("host", ""), session)

    # La imagen identifica a la empresa; el texto identifica al producto.
    # Por eso short_name es fijo: es la glosa que va bajo el ícono.
    manifest = {
        "name": f"EffiGuard · {tenant.nombre_empresa}" if tenant else "EffiGuard",
        "short_name": "EffiGuard",
        "description": "Gestión de activos y control de bodega",
        "theme_color": "#111827",
        "background_color": "#111827",
        "display": "standalone",
        "orientation": "portrait",
        "start_url": "/",
        "scope": "/",
        "icons": _iconos(tenant),
    }

    return JSONResponse(
        content=manifest,
        headers={
            "Content-Type": "application/manifest+json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.get("/apple-touch-icon")
async def apple_touch_icon(request: Request, session: DBSession) -> RedirectResponse:
    """Ícono de "Agregar a inicio" en iOS.

    iOS ignora el manifiesto para esto y exige un <link rel="apple-touch-icon">
    en el documento. Como index.html es un artefacto de build compartido por
    todos los subdominios, no puede llevar la URL versionada: se redirige desde
    esta ruta estable, que sí resuelve por Host.

    Se usa la variante `any`: iOS aplica su propia máscara de esquinas
    redondeadas y no entiende `maskable`.
    """
    tenant = await resolve_tenant_optional(request.headers.get("host", ""), session)
    hash8 = _hash_derivados(tenant)

    destino = (
        pwa_icons.url_derivado(tenant.slug, hash8, 192, "any")
        if hash8
        else _ICONO_GENERICO_APPLE
    )
    return RedirectResponse(url=destino, status_code=302)
