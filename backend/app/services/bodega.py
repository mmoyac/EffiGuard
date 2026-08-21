"""
Consulta de bodega: "¿hay, y dónde está?".

Sólo lectura. Existe para que el operario se responda solo lo que hoy le pregunta
a gritos al bodeguero, que suelta lo que está haciendo y camina hasta el rack.

Las dos reglas que concentra —cómo se expresa la disponibilidad y cómo se resuelve
la ubicación— viven acá y no en la tarjeta de React porque dependen del
comportamiento de la familia, que es dominio. En el componente se duplicarían en
cada pantalla que después quiera mostrar lo mismo, y la primera divergencia sería
silenciosa.
"""

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.variante import Variante
from app.repositories.unidad import UnidadRepository
from app.repositories.variante import VarianteRepository
from app.schemas.bodega import SIN_UBICACION, ItemBodega, UbicacionBodega

# Cómo se lee una unidad de medida en una tarjeta que se mira caminando.
ABREVIATURA = {"unidad": "un", "metro": "m", "kilo": "kg", "litro": "L"}


def _cantidad(valor: Decimal) -> str:
    """240.000 → "240"; 12.500 → "12,5". Los ceros de la escala no dicen nada."""
    texto = format(valor.normalize(), "f")
    return texto.replace(".", ",")


def _parte(etiqueta: str, valor: str | None) -> str:
    """"B" → "Rack B"; "RACK-A" → "RACK-A".

    Rack, nivel y posición son texto libre del tenant, y hay bodegas que ya los
    nombran con su prefijo. Anteponerlo siempre produce "Rack RACK-A · Nivel N2",
    que se lee peor que el dato crudo.
    """
    valor = (valor or "").strip()
    if valor.upper().startswith(etiqueta.upper()):
        return valor
    return f"{etiqueta} {valor}"


def _texto_ubicacion(rack: str | None, nivel: str | None, posicion: str | None) -> str:
    if not rack:
        return SIN_UBICACION
    return " · ".join(
        (_parte("Rack", rack), _parte("Nivel", nivel), _parte("Pos", posicion))
    )


def _ubicacion_de_variante(variante: Variante) -> UbicacionBodega:
    u = variante.ubicacion
    if u is None:
        return UbicacionBodega()
    return UbicacionBodega(
        rack=u.rack,
        nivel=u.nivel,
        posicion=u.posicion,
        texto=_texto_ubicacion(u.rack, u.nivel, u.posicion),
    )


def _item(
    variante: Variante,
    total: int,
    disponibles: int,
    posiciones: list[tuple[str | None, str | None, str | None, int]],
) -> ItemBodega:
    familia = variante.producto.family
    comportamiento = familia.comportamiento

    if comportamiento == "prestable":
        # El stock de un prestable no se almacena: es el conteo de sus ejemplares
        # libres. Y lo que el operario quiere saber es si queda alguno, no cuántos
        # tiene la empresa: "3 de 7" responde ambas de una vez.
        disponibilidad = f"{disponibles} de {total} disponibles"
        hay_stock = disponibles > 0
        stock = None
        # Cada ejemplar puede estar en una repisa distinta. Sin ejemplares libres
        # no hay posiciones que listar, y se cae a la repisa por defecto de la
        # variante: es donde volverán cuando alguien devuelva.
        ubicaciones = [
            UbicacionBodega(
                rack=rack,
                nivel=nivel,
                posicion=posicion,
                texto=_texto_ubicacion(rack, nivel, posicion),
                ejemplares=ejemplares,
            )
            for rack, nivel, posicion, ejemplares in posiciones
        ] or [_ubicacion_de_variante(variante)]
    else:
        unidad = ABREVIATURA.get(variante.unidad, variante.unidad)
        disponibilidad = f"{_cantidad(variante.stock_actual)} {unidad}"
        hay_stock = variante.stock_actual > 0
        stock = variante.stock_actual
        total = disponibles = None
        ubicaciones = [_ubicacion_de_variante(variante)]

    return ItemBodega(
        variante_id=variante.id,
        producto_nombre=variante.producto.nombre,
        variante_nombre=variante.nombre,
        comportamiento=comportamiento,
        unidad=variante.unidad,
        familia_nombre=familia.nombre,
        familia_color=familia.color,
        stock=stock,
        unidades_total=total,
        unidades_disponibles=disponibles,
        disponibilidad_texto=disponibilidad,
        hay_stock=hay_stock,
        ubicaciones=ubicaciones,
    )


async def buscar(
    session: AsyncSession, tenant_id: int, texto: str, limit: int = 50
) -> list[ItemBodega]:
    filas = await VarianteRepository(session, tenant_id).buscar_para_bodega(texto, limit)

    prestables = [
        v.id for v, _, _ in filas if v.producto.family.comportamiento == "prestable"
    ]
    posiciones = await UnidadRepository(session, tenant_id).ubicaciones_disponibles(prestables)

    return [_item(v, total, disp, posiciones.get(v.id, [])) for v, total, disp in filas]
