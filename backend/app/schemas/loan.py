from datetime import datetime

from pydantic import BaseModel


class LoanCreate(BaseModel):
    asset_id: int
    user_id: int          # Operario que recibe
    project_id: int | None = None
    fecha_devolucion_prevista: datetime | None = None


class LoanReturn(BaseModel):
    observaciones: str | None = None


class LoanResponse(BaseModel):
    id: int
    tenant_id: int
    asset_id: int
    user_id: int
    bodeguero_id: int
    project_id: int | None
    fecha_entrega: datetime
    fecha_devolucion_prevista: datetime | None
    fecha_devolucion_real: datetime | None

    model_config = {"from_attributes": True}


class ActiveLoanResponse(LoanResponse):
    """Versión enriquecida del préstamo activo con nombres de usuario y proyecto."""
    user_nombre: str
    user_rut: str
    bodeguero_nombre: str
    proyecto_nombre: str | None
    asset_uid_fisico: str | None = None
