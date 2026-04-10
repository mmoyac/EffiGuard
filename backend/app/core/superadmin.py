"""Dependencias exclusivas del Super Admin (role_id == 1)."""
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.dependencies import CurrentToken, TokenPayload, get_current_token


async def require_super_admin(
    token: Annotated[TokenPayload, Depends(get_current_token)],
) -> TokenPayload:
    if token.role_id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol Super Admin",
        )
    return token


SuperAdminToken = Annotated[TokenPayload, Depends(require_super_admin)]


async def get_acting_tenant_id(
    token: Annotated[TokenPayload, Depends(require_super_admin)],
    x_acting_tenant: Annotated[Optional[str], Header()] = None,
) -> int:
    """
    Retorna el tenant sobre el que opera el super admin.
    Si viene el header X-Acting-Tenant, usa ese ID.
    Si no, usa el tenant_id propio del super admin.
    """
    if x_acting_tenant:
        try:
            return int(x_acting_tenant)
        except ValueError:
            raise HTTPException(status_code=400, detail="X-Acting-Tenant debe ser un entero")
    return token.tenant_id


ActingTenantId = Annotated[int, Depends(get_acting_tenant_id)]
