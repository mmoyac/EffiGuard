from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

# Cantidades de stock y de movimientos de inventario.
#
# Se mantiene Decimal para que la aritmética de stock sea exacta (sumar y restar
# en punto flotante acumula error y deja saldos como 79.99999999), pero se
# serializa como número JSON: Pydantic v2 emite Decimal como string por defecto,
# y el frontend compara `stock_actual <= stock_minimo` y n8n formatea el valor,
# así que un string rompería a ambos.
Cantidad = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]


# La unidad va en la variante y no en la familia: una misma familia mezcla cosas
# que se cuentan (guantes) con cosas que se miden (cinta aisladora).
UNIDADES_VALIDAS = ("unidad", "metro", "kilo", "litro")


class UbicacionNested(BaseModel):
    """Ubicación embebida en la respuesta, para no exigir otra llamada."""

    id: int
    rack: str
    nivel: str
    posicion: str
    descripcion: str | None = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list
