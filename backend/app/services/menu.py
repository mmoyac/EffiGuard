from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu_item import MenuItem
from app.models.role_menu_permission import RoleMenuPermission


async def get_menu_for_role(role_id: int, session: AsyncSession) -> list[MenuItem]:
    """
    Retorna los menu_items permitidos para un role_id, con hijos anidados.
    La navegación del frontend se construye 100% desde este endpoint.
    """
    result = await session.execute(
        select(MenuItem)
        .join(RoleMenuPermission, RoleMenuPermission.menu_item_id == MenuItem.id)
        .where(RoleMenuPermission.role_id == role_id)
        .where(MenuItem.parent_id.is_(None))  # solo raíces; hijos están en children
        .options(selectinload(MenuItem.children).selectinload(MenuItem.children))
        .order_by(MenuItem.orden)
    )
    return list(result.scalars().unique().all())
