import re

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse

# effiguard-{slug}.effi4tech.cl  →  grupo 1 = slug
_SLUG_RE = re.compile(rf"^effiguard-([^.]+)\.{re.escape(settings.BASE_DOMAIN)}(?::\d+)?$")


def _extract_slug(host: str) -> str | None:
    m = _SLUG_RE.match(host)
    return m.group(1) if m else None


async def _resolve_tenant(slug: str, session: AsyncSession) -> Tenant:
    result = await session.execute(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant no encontrado",
        )
    return tenant


async def login(request: LoginRequest, session: AsyncSession, host: str = "") -> TokenResponse:
    slug = _extract_slug(host)

    if slug:
        # Prod: resolver tenant por subdominio y filtrar usuario dentro del tenant
        tenant = await _resolve_tenant(slug, session)
        result = await session.execute(
            select(User).where(
                User.email == request.email,
                User.tenant_id == tenant.id,
            )
        )
    else:
        # Dev/local: búsqueda global por email (sin filtro tenant)
        result = await session.execute(
            select(User).where(User.email == request.email)
        )

    user = result.scalar_one_or_none()

    # Usuario no existe o contraseña incorrecta — mismo mensaje para no revelar info
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    # Usuario existe y contraseña correcta, pero está desactivado
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está desactivada. Contacta al administrador.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id, user.role_id),
        refresh_token=create_refresh_token(user.id),
    )


async def google_login(id_token_str: str, session: AsyncSession, host: str = "") -> TokenResponse:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    import asyncio

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google login no configurado")

    try:
        loop = asyncio.get_event_loop()
        idinfo = await loop.run_in_executor(
            None,
            lambda: google_id_token.verify_oauth2_token(
                id_token_str, google_requests.Request(), settings.GOOGLE_CLIENT_ID
            ),
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de Google inválido")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No se pudo obtener el email de Google")

    slug = _extract_slug(host)
    if slug:
        tenant = await _resolve_tenant(slug, session)
        result = await session.execute(
            select(User).where(User.email == email, User.tenant_id == tenant.id)
        )
    else:
        result = await session.execute(select(User).where(User.email == email))

    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No existe una cuenta con este email")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu cuenta está desactivada. Contacta al administrador.")

    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id, user.role_id),
        refresh_token=create_refresh_token(user.id),
    )


async def refresh(refresh_token: str, session: AsyncSession) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de tipo incorrecto")

    user_id = int(payload["sub"])
    result = await session.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")

    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id, user.role_id),
        refresh_token=create_refresh_token(user.id),
    )
