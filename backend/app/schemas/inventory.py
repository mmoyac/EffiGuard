from datetime import datetime

from pydantic import BaseModel, computed_field

from app.schemas.common import Cantidad


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
    project_id: int | None = None
    proyecto_nombre: str | None = None
    tipo_movimiento: str
    cantidad: Cantidad
    origen_log_id: int | None = None   # Sólo en reintegros: el despacho del que vuelve
    asset_unidad: str | None = None
    # Precio congelado al ocurrir el movimiento. None = sin valorizar, distinto de 0.
    costo_unitario: Cantidad | None = None
    fecha_hora: datetime
    observaciones: str | None

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def costo_total(self) -> float | None:
        if self.costo_unitario is None:
            return None
        return float(self.cantidad * self.costo_unitario)


class CostoProyectoResponse(BaseModel):
    """Costo de material de un proyecto, en líneas separadas.

    No se consolidan: la pérdida diluida dentro del consumo deja de verse, y verla
    es el propósito del sistema.
    """

    project_id: int
    proyecto_nombre: str
    consumo: Cantidad
    perdidas: Cantidad
    mermas: Cantidad
    total: Cantidad
    movimientos_sin_valorizar: int


class DespachoPendienteResponse(BaseModel):
    """Despacho de consumible con material aún no devuelto."""

    despacho_id: int
    cantidad_despachada: Cantidad
    cantidad_reintegrada: Cantidad
    saldo_pendiente: Cantidad
    fecha_hora: datetime
    operario_nombre: str | None = None
    proyecto_nombre: str | None = None
    observaciones: str | None = None


class ConsumoProyectoResponse(BaseModel):
    """Consumo neto de un proyecto: lo despachado menos lo que volvió."""

    project_id: int | None = None
    proyecto_nombre: str | None = None
    despachado: Cantidad
    reintegrado: Cantidad
    consumo_neto: Cantidad
