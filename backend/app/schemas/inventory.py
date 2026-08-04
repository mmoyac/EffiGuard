from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, computed_field

from app.schemas.common import Cantidad


class InventoryLogResponse(BaseModel):
    id: int
    tenant_id: int
    # Nullable mientras conviven los dos catálogos: los movimientos del catálogo
    # nuevo llegan con `variante_id` y sin activo.
    asset_id: int | None = None
    variante_id: int | None = None
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


class ValorBodegaItem(BaseModel):
    asset_id: int
    uid_fisico: str
    nombre: str | None = None
    comportamiento: str
    family_color: str | None = None
    stock_actual: Cantidad
    unidad: str | None = None
    # Cuánto vale cada uno. Sin este dato el panel muestra un total que no se
    # puede verificar de cabeza: "$290.000" no dice si son 2 caros o 20 baratos.
    valor_unitario: Cantidad
    valor: Cantidad
    dias_sin_movimiento: int


class ValorBodegaResponse(BaseModel):
    """Cuánta plata hay parada en bodega.

    Existencias y herramientas van separadas: la primera es capital de trabajo,
    la segunda activo fijo. Sumarlas daría un número sin significado.
    """

    existencias: Cantidad
    herramientas: Cantidad
    activos_sin_precio: int
    detalle: list[ValorBodegaItem]


class VarianteQueryResult(BaseModel):
    """Respuesta para el agente externo: qué hay y dónde encontrarlo."""

    producto: str
    variante: str
    tipo: str                      # prestable | consumible
    unidad: str = "unidad"
    # prestable
    unidades_total: int = 0
    unidades_disponibles: int = 0
    prestadas_a: list[str] = []
    # consumible
    stock_actual: Cantidad = Decimal(0)
    stock_minimo: Cantidad = Decimal(0)
    bajo_stock: bool = False
    # Dónde encontrarlo, para que el agente pueda decirlo sin otra consulta
    ubicacion_rack: str | None = None
    ubicacion_nivel: str | None = None
    ubicacion_posicion: str | None = None


class MaterialDeProyectoResponse(BaseModel):
    """Un material dentro del gasto de una obra: en qué se fue la plata.

    `cantidad` es neta —despachado menos reintegrado—: si salieron 100 y volvieron
    20, la obra ocupó 80.
    """

    asset_id: int | None = None
    variante_id: int | None = None
    nombre: str | None = None
    unidad: str | None = None
    cantidad: Cantidad
    despachado: Cantidad
    reintegrado: Cantidad
    merma: Cantidad
    perdida: Cantidad
    costo: Cantidad


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
