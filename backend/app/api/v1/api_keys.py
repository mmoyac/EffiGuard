import secrets

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.dependencies import CurrentToken, DBSession
from app.models.api_key import ApiKey

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


class ApiKeyCreate(BaseModel):
    description: str  # ej: "n8n producción"


class ApiKeyResponse(BaseModel):
    id: int
    description: str
    key: str | None = None  # solo se muestra al crear
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


@router.post("", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(data: ApiKeyCreate, token: CurrentToken, session: DBSession):
    """Genera una nueva API key para el tenant. Solo admins (role_id <= 2)."""
    if token.role_id > 2:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    key_value = f"efg_{secrets.token_hex(28)}"
    api_key = ApiKey(tenant_id=token.tenant_id, key=key_value, description=data.description)
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    return ApiKeyResponse(
        id=api_key.id,
        description=api_key.description,
        key=key_value,  # única vez que se muestra
        is_active=api_key.is_active,
        created_at=str(api_key.created_at),
    )


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(token: CurrentToken, session: DBSession):
    """Lista las API keys del tenant. La key real no se devuelve, solo metadata."""
    if token.role_id > 2:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    result = await session.execute(
        select(ApiKey).where(ApiKey.tenant_id == token.tenant_id).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        ApiKeyResponse(id=k.id, description=k.description, is_active=k.is_active, created_at=str(k.created_at))
        for k in keys
    ]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(key_id: int, token: CurrentToken, session: DBSession):
    """Revoca una API key (is_active = False)."""
    if token.role_id > 2:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    result = await session.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == token.tenant_id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key no encontrada")
    api_key.is_active = False
    await session.commit()
