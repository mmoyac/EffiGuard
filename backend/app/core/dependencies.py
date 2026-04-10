from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_session

bearer_scheme = HTTPBearer()


class TokenPayload:
    def __init__(self, user_id: int, tenant_id: int, role_id: int):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role_id = role_id


async def get_current_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    x_acting_tenant: Annotated[Optional[str], Header()] = None,
) -> TokenPayload:
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de tipo incorrecto")

    role_id = int(payload["role_id"])
    tenant_id = int(payload["tenant_id"])

    # Super admin puede operar en cualquier tenant vía header
    if role_id == 1 and x_acting_tenant:
        try:
            tenant_id = int(x_acting_tenant)
        except ValueError:
            raise HTTPException(status_code=400, detail="X-Acting-Tenant debe ser un entero")

    return TokenPayload(
        user_id=int(payload["sub"]),
        tenant_id=tenant_id,
        role_id=role_id,
    )


# Dependencias reutilizables
CurrentToken = Annotated[TokenPayload, Depends(get_current_token)]
DBSession = Annotated[AsyncSession, Depends(get_session)]
