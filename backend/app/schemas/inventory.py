from datetime import datetime

from pydantic import BaseModel


class InventoryLogResponse(BaseModel):
    id: int
    tenant_id: int
    asset_id: int
    asset_nombre: str | None = None
    asset_uid: str | None = None
    asset_tipo: str | None = None
    asset_color: str | None = None
    user_id: int
    user_nombre: str | None = None
    operario_id: int | None = None
    operario_nombre: str | None = None
    tipo_movimiento: str
    cantidad: int
    fecha_hora: datetime
    observaciones: str | None

    model_config = {"from_attributes": True}
