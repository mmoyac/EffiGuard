from fastapi import APIRouter

from app.core.dependencies import CurrentToken, DBSession
from app.schemas.menu import MenuItemResponse
from app.services import menu as menu_service

router = APIRouter(prefix="/menu", tags=["Menu"])


@router.get("/", response_model=list[MenuItemResponse])
async def get_menu(token: CurrentToken, session: DBSession):
    """
    Retorna el menú de navegación para el rol del usuario autenticado.
    El frontend construye el sidebar consumiendo este endpoint.
    """
    return await menu_service.get_menu_for_role(token.role_id, session)
