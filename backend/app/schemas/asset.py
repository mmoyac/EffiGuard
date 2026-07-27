from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.asset_family import AssetFamilyResponse
from app.schemas.common import Cantidad

# La unidad va en el activo y no en la familia: una misma familia mezcla cosas
# que se cuentan (guantes) con cosas que se miden (cinta aisladora).
UNIDADES_VALIDAS = ("unidad", "metro", "kilo", "litro")


def _validar_unidad(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip().lower()
    if v not in UNIDADES_VALIDAS:
        raise ValueError(f"unidad inválida. Opciones: {', '.join(UNIDADES_VALIDAS)}")
    return v


def _validar_positivo(v: Decimal | None, campo: str) -> Decimal | None:
    if v is not None and v <= 0:
        raise ValueError(f"{campo} debe ser mayor a 0")
    return v


def _normalizar_codigo(v: str | None) -> str | None:
    """El código de fábrica se compara al escanear, así que se guarda normalizado."""
    if v is None:
        return None
    v = v.strip().upper()
    return v or None


class AssetCreate(BaseModel):
    uid_fisico: str
    codigo_fabricante: str | None = None
    nombre: str | None = None
    model_id: int | None = None
    family_id: int
    estado_id: int
    ubicacion_id: int | None = None
    stock_actual: Cantidad = Decimal(0)
    stock_minimo: Cantidad = Decimal(0)
    unidad: str = "unidad"
    contenido_por_empaque: Cantidad | None = None
    nombre_empaque: str | None = None
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    proxima_mantencion: date | None = None
    parent_asset_id: int | None = None

    @field_validator("contenido_por_empaque", "precio_compra")
    @classmethod
    def validar_positivo(cls, v: Decimal | None, info) -> Decimal | None:
        return _validar_positivo(v, info.field_name)

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, v: str) -> str:
        return _validar_unidad(v)

    @field_validator("codigo_fabricante")
    @classmethod
    def normalizar_codigo(cls, v: str | None) -> str | None:
        return _normalizar_codigo(v)


class AssetUpdate(BaseModel):
    uid_fisico: str | None = None
    codigo_fabricante: str | None = None
    nombre: str | None = None
    estado_id: int | None = None
    model_id: int | None = None
    family_id: int | None = None
    ubicacion_id: int | None = None
    parent_asset_id: int | None = None
    stock_actual: Cantidad | None = None
    stock_minimo: Cantidad | None = None
    unidad: str | None = None
    contenido_por_empaque: Cantidad | None = None
    nombre_empaque: str | None = None
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    proxima_mantencion: date | None = None

    @field_validator("contenido_por_empaque", "precio_compra")
    @classmethod
    def validar_positivo(cls, v: Decimal | None, info) -> Decimal | None:
        return _validar_positivo(v, info.field_name)

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, v: str | None) -> str | None:
        return _validar_unidad(v)

    @field_validator("codigo_fabricante")
    @classmethod
    def normalizar_codigo(cls, v: str | None) -> str | None:
        return _normalizar_codigo(v)


class UbicacionNested(BaseModel):
    """Ubicación embebida en la respuesta del activo, para no exigir otra llamada."""

    id: int
    rack: str
    nivel: str
    posicion: str
    descripcion: str | None = None

    model_config = {"from_attributes": True}


class AssetResponse(BaseModel):
    id: int
    tenant_id: int
    uid_fisico: str
    codigo_fabricante: str | None = None
    nombre: str | None
    parent_asset_id: int | None
    model_id: int | None
    family_id: int
    family: AssetFamilyResponse
    estado_id: int
    ubicacion_id: int | None
    ubicacion: UbicacionNested | None = None
    stock_actual: Cantidad
    stock_minimo: Cantidad
    unidad: str
    contenido_por_empaque: Cantidad | None = None
    nombre_empaque: str | None = None
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None
    dias_max_prestamo: int | None
    proxima_mantencion: date | None
    created_at: datetime
    children: list["AssetResponse"] = []

    model_config = {"from_attributes": True}


AssetResponse.model_rebuild()


class AssetCandidato(BaseModel):
    """Unidad candidata cuando un código de fábrica resuelve varias."""

    id: int
    uid_fisico: str
    nombre: str | None
    estado_id: int
    ubicacion: UbicacionNested | None = None

    model_config = {"from_attributes": True}


class ScanResolution(BaseModel):
    """Resultado de un escaneo.

    El código puede ser el uid_fisico de una unidad o el código de fábrica de un
    producto; en el segundo caso puede haber varias unidades y el operador debe
    elegir cuál está operando.
    """

    tipo: Literal["unico", "multiple"]
    asset: AssetResponse | None = None
    codigo_fabricante: str | None = None
    candidatos: list[AssetCandidato] = []


class AltaPorCodigo(BaseModel):
    codigo_fabricante: str
    cantidad: int = Field(default=1, ge=1, le=100)

    @field_validator("codigo_fabricante")
    @classmethod
    def normalizar_codigo(cls, v: str) -> str:
        return _normalizar_codigo(v)


class ProductoPreview(BaseModel):
    """Qué producto se clonaría al dar de alta unidades nuevas por su código."""

    codigo_fabricante: str
    nombre: str | None
    family_id: int
    unidad: str
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    unidades_existentes: int


class AssetQueryResult(BaseModel):
    nombre: str | None
    tipo: str                   # prestable | consumible
    # prestable
    estado: str = ""
    operario: str | None = None       # nombre del operario si está prestada
    fecha_prestamo: str | None = None # fecha y hora desde que la tiene
    # consumible
    stock_actual: Cantidad = Decimal(0)
    stock_minimo: Cantidad = Decimal(0)
    unidad: str = "unidad"
    bajo_stock: bool = False
    # ubicación en bodega — para que el agente pueda decir dónde encontrarlo
    ubicacion_rack: str | None = None
    ubicacion_nivel: str | None = None
    ubicacion_posicion: str | None = None


class ConsumableWithdraw(BaseModel):
    asset_id: int
    cantidad: Cantidad
    operario_id: int
    project_id: int | None = None
    observaciones: str | None = None


class AssetLoss(BaseModel):
    cantidad: Cantidad = Decimal(1)   # Para consumibles; herramientas siempre 1
    # Dónde se perdió. Sin proyecto la pérdida es de bodega, no de una obra.
    project_id: int | None = None
    observaciones: str | None = None


class AssetAdjust(BaseModel):
    stock_nuevo: Cantidad      # Nuevo valor absoluto de stock
    observaciones: str | None = None


class AssetPurchase(BaseModel):
    """Compra de consumible, expresada en unidades o en empaques.

    Exactamente uno de los dos: aceptar ambos obligaría a decidir cuál gana ante
    una discrepancia, y cualquier respuesta sería una suposición.
    """

    cantidad: Cantidad | None = None   # En la unidad de stock (tornillos, metros)
    empaques: Cantidad | None = None   # En el envase configurado del activo (cajas, rollos)
    # Lo que dice la factura. La compra es el único movimiento donde el precio se
    # conoce con certeza: los demás lo heredan, éste lo establece.
    precio_total: Cantidad | None = None
    # El precio recién pagado pasa a ser el vigente del producto. Se puede desmarcar
    # para una compra de emergencia a sobreprecio que no debe arrastrar el resto.
    actualizar_precio: bool = True
    observaciones: str | None = None

    @field_validator("precio_total")
    @classmethod
    def validar_precio(cls, v: Decimal | None) -> Decimal | None:
        return _validar_positivo(v, "precio_total")


class AssetShrinkage(BaseModel):
    cantidad: Cantidad         # Unidades a descontar (merma, vencimiento, daño)
    # Dónde ocurrió. Sin proyecto la merma es de bodega, no de una obra.
    project_id: int | None = None
    observaciones: str | None = None


class AssetReintegro(BaseModel):
    """Material despachado que vuelve sin consumirse.

    No es una compra (no ingresa material nuevo) ni una pérdida (no se extravió):
    apunta al despacho del que vuelve, y lo que no vuelve es consumo del proyecto.
    """

    origen_log_id: int         # Despacho (movimiento 'entrega') contra el que se devuelve
    cantidad: Cantidad
    observaciones: str | None = None


class AssetRepairDone(BaseModel):
    observaciones: str | None = None  # Ej: "Cambio de carbones, revisión eléctrica"
