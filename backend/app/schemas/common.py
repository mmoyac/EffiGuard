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


class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list
