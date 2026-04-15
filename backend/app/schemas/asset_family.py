from pydantic import BaseModel


class AssetFamilyCreate(BaseModel):
    nombre: str
    comportamiento: str  # prestable | consumible
    color: str = "blue"
    dias_max_prestamo: int | None = None


class AssetFamilyUpdate(BaseModel):
    nombre: str | None = None
    color: str | None = None
    dias_max_prestamo: int | None = None


class AssetFamilyResponse(BaseModel):
    id: int
    tenant_id: int
    nombre: str
    comportamiento: str
    color: str
    dias_max_prestamo: int | None

    model_config = {"from_attributes": True}
