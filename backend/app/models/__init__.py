# Importar todos los modelos para que Alembic los detecte automáticamente
from app.models.api_key import ApiKey
from app.models.asset_family import AssetFamily
from app.models.asset_state import AssetState
from app.models.brand import Brand
from app.models.codigo import Codigo
from app.models.inventory_log import InventoryLog
from app.models.loan import Loan
from app.models.menu_item import MenuItem
from app.models.module import Module
from app.models.producto import Producto
from app.models.project import Project
from app.models.proveedor import Proveedor
from app.models.role import Role
from app.models.role_menu_permission import RoleMenuPermission
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.ubicacion import Ubicacion
from app.models.unidad import Unidad
from app.models.user import User
from app.models.variante import Variante

__all__ = [
    "Tenant", "Role", "User",
    "Module", "MenuItem", "RoleMenuPermission",
    "Brand", "AssetFamily", "AssetState", "Project", "Ubicacion",
    # Catálogo: producto → variante → unidad, con sus códigos y proveedores.
    "Producto", "Variante", "Unidad", "Codigo", "Proveedor",
    "Loan", "InventoryLog", "Subscription", "ApiKey",
]
