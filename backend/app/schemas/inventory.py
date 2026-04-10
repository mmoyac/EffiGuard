from datetime import datetime

from pydantic import BaseModel


class InventoryLogResponse(BaseModel):
    id: int
    tenant_id: int
    asset_id: int
    user_id: int
    tipo_movimiento: str
    cantidad: int
    fecha_hora: datetime
    observaciones: str | None

    model_config = {"from_attributes": True}
