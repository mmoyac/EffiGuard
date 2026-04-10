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

# effiguard-{slug}.lexastech.cl  →  grupo 1 = slug
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
                User.is_active == True,
            )
        )
    else:
        # Dev/local: búsqueda global por email (sin filtro tenant)
        result = await session.execute(
            select(User).where(User.email == request.email, User.is_active == True)
        )

    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

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
