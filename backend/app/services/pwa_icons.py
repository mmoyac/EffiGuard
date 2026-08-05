"""Derivación de los íconos PWA a partir del logo de cada tenant.

Los derivados se generan al subir el logo, no bajo demanda: así son archivos
estáticos comunes, servidos por el mismo `StaticFiles` que ya sirve los logos,
sin caché propia ni latencia en el momento de instalar la app.

El nombre incluye un hash del contenido del logo de origen. Un logo distinto
produce URLs distintas, así que los derivados pueden cachearse indefinidamente
y un cambio de logo se propaga sin invalidación activa en ninguna capa.
"""

import hashlib
import logging
import os

from PIL import Image

logger = logging.getLogger(__name__)

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "pwa-icons")

# Color de fondo de la app. Un logo con transparencia se compone sobre esto.
_FONDO = (17, 24, 39)  # #111827

_TAMANOS = (192, 512)

# Fracción del lienzo que ocupa el logo en cada variante.
# La zona segura de un ícono maskable es el 80% central: lo que queda fuera
# puede ser recortado por la máscara adaptativa del sistema.
_ESCALA = {"any": 1.0, "maskable": 0.8}


def hash_logo(logo_path: str) -> str:
    """Primeros 8 chars del SHA-256 del archivo, para versionar la URL."""
    h = hashlib.sha256()
    with open(logo_path, "rb") as f:
        for bloque in iter(lambda: f.read(65536), b""):
            h.update(bloque)
    return h.hexdigest()[:8]


def nombre_derivado(slug: str, hash8: str, size: int, purpose: str) -> str:
    return f"{slug}-{hash8}-{size}-{purpose}.png"


def ruta_derivado(slug: str, hash8: str, size: int, purpose: str) -> str:
    return os.path.join(ICONS_DIR, nombre_derivado(slug, hash8, size, purpose))


def url_derivado(slug: str, hash8: str, size: int, purpose: str) -> str:
    return f"/static/pwa-icons/{nombre_derivado(slug, hash8, size, purpose)}"


def _componer(origen: Image.Image, size: int, escala: float) -> Image.Image:
    """Logo centrado en `contain` sobre el fondo de la app.

    `contain` conserva la proporción: un logo rectangular no se deforma, se
    rellena con fondo el espacio sobrante.
    """
    lienzo = Image.new("RGB", (size, size), _FONDO)

    disponible = int(size * escala)
    copia = origen.copy()
    copia.thumbnail((disponible, disponible), Image.LANCZOS)

    offset = ((size - copia.width) // 2, (size - copia.height) // 2)
    # La máscara alpha evita que el fondo transparente se pinte de negro.
    lienzo.paste(copia, offset, copia if copia.mode == "RGBA" else None)
    return lienzo


def generar_derivados(logo_path: str, slug: str) -> str | None:
    """Genera los cuatro PNG del tenant. Devuelve el hash, o None si no se pudo.

    No propaga excepciones: un logo que Pillow no sabe abrir (un SVG, por
    ejemplo) deja al tenant con los íconos genéricos, que es degradación
    aceptable y no un error de la carga del logo.
    """
    if not os.path.exists(logo_path):
        logger.warning("pwa_icons: no existe el logo %s", logo_path)
        return None

    try:
        hash8 = hash_logo(logo_path)
        with Image.open(logo_path) as img:
            origen = img.convert("RGBA")

        os.makedirs(ICONS_DIR, exist_ok=True)
        for size in _TAMANOS:
            for purpose, escala in _ESCALA.items():
                destino = ruta_derivado(slug, hash8, size, purpose)
                _componer(origen, size, escala).save(destino, "PNG", optimize=True)

        return hash8
    except Exception as exc:  # noqa: BLE001 - degradar, nunca romper la carga
        logger.warning("pwa_icons: no se pudo derivar %s (%s): %s", logo_path, slug, exc)
        return None


def derivados_existen(slug: str, hash8: str) -> bool:
    """True sólo si están los cuatro archivos.

    Se consulta antes de apuntar el manifiesto a ellos: mientras el backfill no
    haya corrido, es preferible el ícono genérico a una URL que da 404.
    """
    return all(
        os.path.exists(ruta_derivado(slug, hash8, size, purpose))
        for size in _TAMANOS
        for purpose in _ESCALA
    )


def eliminar_derivados(slug: str, hash8: str) -> None:
    """Borra los derivados de un logo reemplazado."""
    for size in _TAMANOS:
        for purpose in _ESCALA:
            ruta = ruta_derivado(slug, hash8, size, purpose)
            if os.path.exists(ruta):
                try:
                    os.remove(ruta)
                except OSError as exc:
                    logger.warning("pwa_icons: no se pudo borrar %s: %s", ruta, exc)
