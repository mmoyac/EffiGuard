from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.schemas.auth import LoginRequest, MeResponse, RefreshRequest, TokenResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, session: DBSession):
    return await auth_service.login(request, session)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, session: DBSession):
    return await auth_service.refresh(request.refresh_token, session)


@router.get("/me", response_model=MeResponse)
async def me(token: CurrentToken, session: DBSession):
    from sqlalchemy import select
    from app.models.user import User
    from app.models.tenant import Tenant

    result = await session.execute(
        select(User, Tenant.nombre_empresa.label("tenant_nombre"))
        .join(Tenant, User.tenant_id == Tenant.id)
        .where(User.id == token.user_id)
    )
    row = result.first()
    user, tenant_nombre = row
    return MeResponse(
        id=user.id,
        nombre=user.nombre,
        email=user.email,
        role_id=user.role_id,
        tenant_id=user.tenant_id,
        tenant_nombre=tenant_nombre,
        uid_credencial=user.uid_credencial,
    )
