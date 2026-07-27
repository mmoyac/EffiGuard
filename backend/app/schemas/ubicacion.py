from pydantic import BaseModel, field_validator


def _normalizar(valor: str) -> str:
    """Trim + mayúsculas: 'a1' y ' A1 ' deben ser la misma ubicación."""
    return valor.strip().upper()


class UbicacionCreate(BaseModel):
    rack: str
    nivel: str
    posicion: str
    descripcion: str | None = None

    @field_validator("rack", "nivel", "posicion")
    @classmethod
    def normalizar(cls, v: str) -> str:
        v = _normalizar(v)
        if not v:
            raise ValueError("rack, nivel y posición no pueden estar vacíos")
        return v


class UbicacionUpdate(BaseModel):
    rack: str | None = None
    nivel: str | None = None
    posicion: str | None = None
    descripcion: str | None = None

    @field_validator("rack", "nivel", "posicion")
    @classmethod
    def normalizar(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = _normalizar(v)
        if not v:
            raise ValueError("rack, nivel y posición no pueden estar vacíos")
        return v


class UbicacionResponse(BaseModel):
    id: int
    tenant_id: int
    rack: str
    nivel: str
    posicion: str
    descripcion: str | None

    model_config = {"from_attributes": True}


class UbicacionConflict(BaseModel):
    """Detalle del 409: se devuelve la ubicación existente para que el cliente la seleccione."""

    detail: str
    existente: UbicacionResponse
