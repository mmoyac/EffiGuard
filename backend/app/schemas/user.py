from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    rut: str
    nombre: str
    email: EmailStr
    password: str
    role_id: int
    uid_credencial: str | None = None


class UserUpdate(BaseModel):
    nombre: str | None = None
    email: EmailStr | None = None
    role_id: int | None = None
    uid_credencial: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    tenant_id: int
    role_id: int
    rut: str
    nombre: str
    email: str
    uid_credencial: str | None
    is_active: bool

    model_config = {"from_attributes": True}
