from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: int
    nombre: str
    email: str
    role_id: int
    tenant_id: int
    tenant_nombre: str
    uid_credencial: str | None

    model_config = {"from_attributes": True}
