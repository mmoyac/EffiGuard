from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class LoanCreate(BaseModel):
    unidad_id: int        # El ejemplar concreto que se lleva
    user_id: int          # Operario que recibe
    project_id: int | None = None
    fecha_devolucion_prevista: datetime | None = None
    # `plazo` vuelve; `a_cargo` queda con el operario y nunca se le reclama.
    # Por defecto plazo: dejar una herramienta a cargo se elige queriendo.
    modalidad: Literal["plazo", "a_cargo"] = "plazo"


class LoanReturn(BaseModel):
    returning_user_id: int        # Operario que devuelve — debe coincidir con quien retiró
    observaciones: str | None = None
    send_to_repair: bool = False  # Si True, deja la herramienta en estado "En Reparación"


class LoanResponse(BaseModel):
    id: int
    tenant_id: int
    unidad_id: int
    user_id: int
    bodeguero_id: int
    project_id: int | None
    fecha_entrega: datetime
    fecha_devolucion_prevista: datetime | None
    fecha_devolucion_real: datetime | None
    modalidad: str

    model_config = {"from_attributes": True}


class ActiveLoanResponse(LoanResponse):
    """Versión enriquecida del préstamo activo con nombres de usuario y proyecto."""
    user_nombre: str
    user_rut: str
    bodeguero_nombre: str
    proyecto_nombre: str | None
    asset_uid_fisico: str | None = None
    asset_nombre: str | None = None
