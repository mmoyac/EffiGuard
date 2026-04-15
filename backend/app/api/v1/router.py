from fastapi import APIRouter

from app.api.v1 import asset_families, assets, auth, catalog, dashboard, import_assets, inventory, loans, menu, projects, pwa, superadmin, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
api_router.include_router(assets.router)
api_router.include_router(import_assets.router)
api_router.include_router(asset_families.router)
api_router.include_router(loans.router)
api_router.include_router(inventory.router)
api_router.include_router(menu.router)
api_router.include_router(projects.router)
api_router.include_router(catalog.router)
api_router.include_router(superadmin.router)
api_router.include_router(pwa.router)
