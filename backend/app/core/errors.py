"""Traducción de choques de unicidad a mensajes que el usuario entienda.

Sin esto, un `uid_credencial` repetido sube como IntegrityError sin capturar, sale
como 500 y el frontend lo muestra con su mensaje genérico ("Error al actualizar
usuario"), que no dice qué campo choca ni cómo arreglarlo.
"""
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

# El texto del driver trae el nombre de la restricción
# (`users_uid_credencial_key`), así que basta con buscar la columna dentro.
_COLUMNAS_USUARIO = (
    ("uid_credencial", "Esa credencial ya está asignada a otro usuario"),
    ("email", "Ya existe un usuario con ese email"),
    ("rut", "Ya existe un usuario con ese RUT"),
)


def error_usuario_duplicado(e: IntegrityError, por_defecto: str) -> HTTPException:
    """Devuelve —no lanza— el 400 que corresponde al campo en conflicto."""
    err = str(e.orig)
    for columna, mensaje in _COLUMNAS_USUARIO:
        if columna in err:
            return HTTPException(status_code=400, detail=mensaje)
    return HTTPException(status_code=400, detail=por_defecto)


def error_credencial_ocupada(nombre: str) -> HTTPException:
    """El 400 que nombra a quien ya tiene la credencial.

    Nombrarlo es la diferencia entre un error accionable y uno que obliga a ir a
    la base: el administrador busca ese nombre en su lista y le quita la tarjeta.
    Sólo es seguro porque el portador se busca dentro del tenant — uno global
    nombraría a alguien de otra empresa, que el administrador no puede ver.
    """
    return HTTPException(status_code=400, detail=f"Esa credencial ya la tiene {nombre}")
