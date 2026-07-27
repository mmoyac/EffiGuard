import uuid

PREFIJO = "EFG-"


def generar_uid(usados: set[str]) -> str:
    """Genera un uid_fisico interno con formato EFG-XXXXXXXX.

    Es el identificador de la unidad, distinto del código de fábrica: éste lo
    imprime EffiGuard en la etiqueta y dice CUÁL unidad es; el del fabricante
    viene en la caja y dice QUÉ producto es.
    """
    while True:
        uid = f"{PREFIJO}{uuid.uuid4().hex[:8].upper()}"
        if uid not in usados:
            return uid
