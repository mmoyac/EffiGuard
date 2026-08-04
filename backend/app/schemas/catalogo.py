from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.codigo import TIPOS_VALIDOS
from app.schemas.asset_family import AssetFamilyResponse
from app.schemas.common import UNIDADES_VALIDAS, Cantidad, UbicacionNested


def _normalizar_codigo(v: str) -> str:
    """Se compara al escanear, así que se guarda normalizado."""
    return v.strip().upper()


def _validar_unidad(v: str) -> str:
    v = v.strip().lower()
    if v not in UNIDADES_VALIDAS:
        raise ValueError(f"unidad inválida. Opciones: {', '.join(UNIDADES_VALIDAS)}")
    return v


# ── Proveedores ──────────────────────────────────────────────────────────────


class ProveedorCreate(BaseModel):
    nombre: str = Field(min_length=1)
    rut: str | None = None
    contacto: str | None = None

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre del proveedor es obligatorio")
        return v


class ProveedorUpdate(BaseModel):
    nombre: str | None = None
    rut: str | None = None
    contacto: str | None = None


class ProveedorResponse(BaseModel):
    id: int
    tenant_id: int
    nombre: str
    rut: str | None
    contacto: str | None

    model_config = {"from_attributes": True}


# ── Códigos ──────────────────────────────────────────────────────────────────


class CodigoCreate(BaseModel):
    codigo: str = Field(min_length=1)
    tipo: str
    proveedor_id: int | None = None
    factor: Cantidad = Decimal(1)
    nombre_empaque: str | None = None
    # Sin dueño explícito lo pone la ruta (/variantes/{id}/codigos o /unidades/{id}/codigos)
    variante_id: int | None = None
    unidad_id: int | None = None

    @field_validator("codigo")
    @classmethod
    def normalizar(cls, v: str) -> str:
        return _normalizar_codigo(v)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in TIPOS_VALIDOS:
            raise ValueError(f"tipo inválido. Opciones: {', '.join(TIPOS_VALIDOS)}")
        return v

    @field_validator("factor")
    @classmethod
    def validar_factor(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El factor debe ser mayor a 0")
        return v


class CodigoResponse(BaseModel):
    id: int
    codigo: str
    tipo: str
    proveedor_id: int | None
    proveedor_nombre: str | None = None
    factor: Cantidad
    nombre_empaque: str | None
    es_principal: bool
    variante_id: int | None
    unidad_id: int | None

    model_config = {"from_attributes": True}


# ── Unidades ─────────────────────────────────────────────────────────────────


class UnidadCreate(BaseModel):
    """Alta por cantidad: recibir 10 taladros iguales es una operación, no diez."""

    cantidad: int = Field(default=1, ge=1, le=500)
    ubicacion_id: int | None = None
    estado_id: int = 1  # Disponible
    proxima_mantencion: date | None = None


class UnidadUpdate(BaseModel):
    """Lo editable de un ejemplar.

    El estado NO se edita: se mueve por préstamo, devolución, reparación o pérdida,
    para que cada cambio quede explicado por el hecho que lo provocó.
    """

    ubicacion_id: int | None = None
    proxima_mantencion: date | None = None


class UnidadResponse(BaseModel):
    id: int
    tenant_id: int
    variante_id: int
    estado_id: int
    ubicacion_id: int | None
    ubicacion: UbicacionNested | None = None
    parent_unidad_id: int | None
    proxima_mantencion: date | None
    created_at: datetime
    codigos: list[CodigoResponse] = []
    # El que se imprime en la etiqueta y se muestra en listados.
    codigo_principal: str | None = None

    model_config = {"from_attributes": True}


# ── Variantes ────────────────────────────────────────────────────────────────


class VarianteCreate(BaseModel):
    nombre: str = Field(min_length=1)
    atributos: dict = {}
    unidad: str = "unidad"
    stock_actual: Cantidad = Decimal(0)
    stock_minimo: Cantidad = Decimal(0)
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    ubicacion_id: int | None = None
    codigos: list[CodigoCreate] = []
    # Sólo para familias prestables: cuántos ejemplares crear junto con la variante.
    cantidad_unidades: int = Field(default=0, ge=0, le=500)

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, v: str) -> str:
        return _validar_unidad(v)


class VarianteUpdate(BaseModel):
    nombre: str | None = None
    atributos: dict | None = None
    unidad: str | None = None
    stock_minimo: Cantidad | None = None
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    ubicacion_id: int | None = None

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, v: str | None) -> str | None:
        return _validar_unidad(v) if v is not None else None


class VarianteResponse(BaseModel):
    id: int
    tenant_id: int
    producto_id: int
    producto_nombre: str
    nombre: str
    atributos: dict
    unidad: str
    comportamiento: str            # heredado de la familia del producto
    family: AssetFamilyResponse
    stock_actual: Cantidad
    stock_minimo: Cantidad
    # Unificado: la columna si es consumible, el conteo de disponibles si es prestable.
    stock_efectivo: Cantidad
    bajo_stock: bool
    unidades_total: int = 0
    unidades_disponibles: int = 0
    precio_compra: Cantidad | None
    valor_reposicion: Decimal | None
    dias_max_prestamo: int | None
    ubicacion_id: int | None
    ubicacion: UbicacionNested | None = None
    created_at: datetime
    codigos: list[CodigoResponse] = []

    model_config = {"from_attributes": True}


class VarianteDetalle(VarianteResponse):
    unidades: list[UnidadResponse] = []


# ── Movimientos ──────────────────────────────────────────────────────────────


class VariantePurchase(BaseModel):
    """Compra de consumible, expresada en unidades o en empaques.

    Exactamente uno de los dos: aceptar ambos obligaría a decidir cuál gana ante
    una discrepancia, y cualquier respuesta sería una suposición sobre lo que el
    bodeguero quiso decir.

    Con `empaques` va el `codigo_id` del empaque escaneado: ahí vive el factor.
    La caja de un proveedor trae 100 y la del otro 250, así que el contenido lo
    aporta el código, no el producto.
    """

    cantidad: Cantidad | None = None
    empaques: Cantidad | None = None
    codigo_id: int | None = None
    # Se deduce del código cuando hay uno. El bodeguero opera con guantes: cada
    # campo que hay que elegir a mano es un campo que se llena mal o se salta.
    proveedor_id: int | None = None
    precio_total: Cantidad | None = None
    actualizar_precio: bool = True
    observaciones: str | None = None

    @field_validator("precio_total")
    @classmethod
    def validar_precio(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("precio_total debe ser mayor a 0")
        return v


class VarianteWithdraw(BaseModel):
    """Retiro de consumible. NO crea préstamo: un tornillo no se devuelve."""

    cantidad: Cantidad
    operario_id: int
    project_id: int | None = None
    observaciones: str | None = None


class UnidadAccion(BaseModel):
    """Acción sobre un ejemplar concreto: siempre una unidad, nunca una cantidad."""

    project_id: int | None = None
    observaciones: str | None = None


class VarianteAdjust(BaseModel):
    """Ajuste a valor absoluto: el resultado del conteo físico, no la diferencia.

    Se pide el número contado y no el delta porque es lo que el bodeguero tiene en
    la mano al terminar de contar; calcular la resta a mano es una oportunidad más
    de equivocarse.
    """

    stock_nuevo: Cantidad
    observaciones: str | None = None


class VarianteShrinkage(BaseModel):
    """Merma: material que se dañó, venció o se contó de menos."""

    cantidad: Cantidad
    # Dónde ocurrió. Sin proyecto la merma es de bodega, no de una obra.
    project_id: int | None = None
    observaciones: str | None = None


class VarianteLoss(BaseModel):
    """Pérdida o robo de consumible."""

    cantidad: Cantidad = Decimal(1)
    project_id: int | None = None
    observaciones: str | None = None


class VarianteReintegro(BaseModel):
    """Material despachado que vuelve sin consumirse.

    No es compra (no ingresa material nuevo) ni ajuste (no corrige un conteo):
    apunta al despacho del que vuelve, y lo que no vuelve es consumo del proyecto.
    """

    origen_log_id: int
    cantidad: Cantidad
    observaciones: str | None = None


class DespachoPendienteResponse(BaseModel):
    """Entrega que todavía admite reintegro."""

    despacho_id: int
    cantidad_despachada: Cantidad
    cantidad_reintegrada: Cantidad
    saldo_pendiente: Cantidad
    fecha_hora: datetime
    operario_nombre: str | None = None
    proyecto_nombre: str | None = None
    observaciones: str | None = None


class MovimientoResponse(BaseModel):
    id: int
    variante_id: int | None
    unidad_id: int | None
    codigo_id: int | None
    proveedor_id: int | None
    proveedor_nombre: str | None = None
    tipo_movimiento: str
    cantidad: Cantidad
    costo_unitario: Decimal | None = None
    operario_id: int | None = None
    operario_nombre: str | None = None
    project_id: int | None = None
    fecha_hora: datetime
    observaciones: str | None = None

    model_config = {"from_attributes": True}


# ── Productos ────────────────────────────────────────────────────────────────


class ProductoCreate(BaseModel):
    """
    Alta en un solo formulario.

    Si no se declaran variantes se crea una homónima con los datos operativos de
    la raíz: la mayoría de los consumibles no tiene variantes reales, y exigir dos
    pasos cobraría el costo del modelo en el caso más común sin dar nada a cambio.
    """

    nombre: str = Field(min_length=1)
    family_id: int
    brand_id: int | None = None
    descripcion: str | None = None
    variantes: list[VarianteCreate] = []

    # Datos de la variante implícita, ignorados si se declaran variantes.
    unidad: str = "unidad"
    stock_actual: Cantidad = Decimal(0)
    stock_minimo: Cantidad = Decimal(0)
    precio_compra: Cantidad | None = None
    valor_reposicion: Decimal | None = None
    dias_max_prestamo: int | None = None
    ubicacion_id: int | None = None
    codigos: list[CodigoCreate] = []
    cantidad_unidades: int = Field(default=0, ge=0, le=500)

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, v: str) -> str:
        return _validar_unidad(v)


class ProductoUpdate(BaseModel):
    nombre: str | None = None
    family_id: int | None = None
    brand_id: int | None = None
    descripcion: str | None = None


class ProductoResponse(BaseModel):
    id: int
    tenant_id: int
    nombre: str
    descripcion: str | None
    family_id: int
    family: AssetFamilyResponse
    comportamiento: str
    brand_id: int | None
    brand_nombre: str | None = None
    created_at: datetime
    variantes: list[VarianteResponse] = []

    model_config = {"from_attributes": True}
