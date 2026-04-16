from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.asset_family import AssetFamilyResponse


class AssetCreate(BaseModel):
    uid_fisico: str
    nombre: str | None = None
    model_id: int | None = None
    family_id: int
    estado_id: int
    stock_actual: int = 0
    stock_minimo: int = 0
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    proxima_mantencion: date | None = None
    parent_asset_id: int | None = None


class AssetUpdate(BaseModel):
    uid_fisico: str | None = None
    nombre: str | None = None
    estado_id: int | None = None
    model_id: int | None = None
    family_id: int | None = None
    parent_asset_id: int | None = None
    stock_actual: int | None = None
    stock_minimo: int | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    proxima_mantencion: date | None = None


class AssetResponse(BaseModel):
    id: int
    tenant_id: int
    uid_fisico: str
    nombre: str | None
    parent_asset_id: int | None
    model_id: int | None
    family_id: int
    family: AssetFamilyResponse
    estado_id: int
    stock_actual: int
    stock_minimo: int
    valor_reposicion: Decimal | None
    dias_max_prestamo: int | None
    proxima_mantencion: date | None
    created_at: datetime
    children: list["AssetResponse"] = []

    model_config = {"from_attributes": True}


AssetResponse.model_rebuild()


class AssetQueryResult(BaseModel):
    nombre: str | None
    tipo: str                   # prestable | consumible
    # prestable
    disponibles: int = 0
    en_terreno: int = 0
    en_reparacion: int = 0
    total: int = 0
    # consumible
    stock_actual: int = 0
    stock_minimo: int = 0
    bajo_stock: bool = False


class ConsumableWithdraw(BaseModel):
    asset_id: int
    cantidad: int
    operario_id: int
    project_id: int | None = None
    observaciones: str | None = None


class AssetLoss(BaseModel):
    cantidad: int = 1          # Para consumibles; herramientas siempre 1
    observaciones: str | None = None


class AssetAdjust(BaseModel):
    stock_nuevo: int           # Nuevo valor absoluto de stock
    observaciones: str | None = None


class AssetPurchase(BaseModel):
    cantidad: int              # Unidades compradas (se suman al stock actual)
    observaciones: str | None = None


class AssetShrinkage(BaseModel):
    cantidad: int              # Unidades a descontar (merma, vencimiento, daño)
    observaciones: str | None = None


class AssetRepairDone(BaseModel):
    observaciones: str | None = None  # Ej: "Cambio de carbones, revisión eléctrica"
