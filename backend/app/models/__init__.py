# Importar todos los modelos para que Alembic los detecte automáticamente
from app.models.asset import Asset
from app.models.asset_family import AssetFamily
from app.models.asset_model import AssetModel
from app.models.asset_state import AssetState
from app.models.brand import Brand
from app.models.inventory_log import InventoryLog
from app.models.loan import Loan
from app.models.menu_item import MenuItem
from app.models.module import Module
from app.models.project import Project
from app.models.role import Role
from app.models.role_menu_permission import RoleMenuPermission
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User

__all__ = [
    "Tenant", "Role", "User",
    "Module", "MenuItem", "RoleMenuPermission",
    "Brand", "AssetModel", "AssetFamily", "AssetState", "Project",
    "Asset", "Loan", "InventoryLog", "Subscription",
]
