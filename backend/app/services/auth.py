from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse


async def login(request: LoginRequest, session: AsyncSession) -> TokenResponse:
    # Buscar usuario por email (sin filtro tenant — el email es global)
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
