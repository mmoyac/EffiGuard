"""
Consulta de bodega, de sólo lectura.

Abierta a cualquier rol autenticado del tenant: no expone costos, no mueve stock, y
la misma pregunta —"¿hay, y dónde está?"— se la hace tanto el operario que camina
al mesón como el bodeguero que lo atiende.
"""
from fastapi import APIRouter, Query

from app.core.dependencies import CurrentToken, DBSession
from app.schemas.bodega import ItemBodega
from app.services import bodega as bodega_service

router = APIRouter(prefix="/bodega", tags=["Bodega"])


@router.get("/buscar", response_model=list[ItemBodega])
async def buscar(
    token: CurrentToken,
    session: DBSession,
    # Mínimo 2 caracteres para que un roce del teclado no devuelva el catálogo
    # entero; tope de 50 porque esto sirve para encontrar algo puntual, no para
    # pasear el inventario.
    q: str = Query(min_length=2, description="Nombre del material o código exacto de la caja"),
    limit: int = Query(50, le=50),
):
    return await bodega_service.buscar(session, token.tenant_id, q, limit)
