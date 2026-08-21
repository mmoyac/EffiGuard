"""Respuesta de la consulta de bodega.

Schemas propios y no `VarianteResponse` a propósito: aquel lleva `precio_compra` y
`valor_reposicion`, y esta consulta la puede hacer cualquiera del tenant. Filtrar
campos según el rol es el condicional que se olvida la próxima vez que alguien
agrega un campo a la respuesta; un schema que no tiene el campo no puede filtrarlo mal.
"""

from pydantic import BaseModel

from app.schemas.common import Cantidad

SIN_UBICACION = "Sin ubicación asignada"


class UbicacionBodega(BaseModel):
    """Una posición física donde encontrar el item.

    `texto` viaja siempre armado —incluida la leyenda de que falta el dato— para que
    la tarjeta no tenga que decidir qué mostrar cuando rack, nivel y posición son nulos.
    """

    rack: str | None = None
    nivel: str | None = None
    posicion: str | None = None
    texto: str = SIN_UBICACION
    # Cuántos ejemplares disponibles hay en esta posición. Sólo para prestables:
    # un consumible tiene una sola pila y su cantidad ya viaja en `stock`.
    ejemplares: int | None = None


class ItemBodega(BaseModel):
    variante_id: int
    producto_nombre: str
    variante_nombre: str
    comportamiento: str  # prestable | consumible
    unidad: str
    familia_nombre: str
    familia_color: str | None = None

    # Números crudos, por si la interfaz quiere componer otra cosa. La regla de qué
    # significa "disponible" depende del comportamiento y ya viene resuelta en
    # `disponibilidad_texto`: dejarla en el componente la duplicaría en cada pantalla.
    stock: Cantidad | None = None
    unidades_total: int | None = None
    unidades_disponibles: int | None = None

    disponibilidad_texto: str
    hay_stock: bool

    # Nunca vacía: cuando no hay ubicación cargada trae una entrada con la leyenda,
    # para que la falta del dato se vea y alguien la cargue.
    ubicaciones: list[UbicacionBodega]
