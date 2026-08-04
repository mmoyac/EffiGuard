from fastapi import APIRouter

from app.api.v1 import api_keys, asset_families, auth, catalog, catalogo, dashboard, import_catalogo, integraciones, inventory, loans, menu, projects, proveedores, pwa, superadmin, ubicaciones, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
api_router.include_router(asset_families.router)
api_router.include_router(ubicaciones.router)
api_router.include_router(loans.router)
api_router.include_router(inventory.router)
api_router.include_router(menu.router)
api_router.include_router(projects.router)
api_router.include_router(catalog.router)
api_router.include_router(api_keys.router)
api_router.include_router(superadmin.router)
api_router.include_router(pwa.router)

# Catálogo producto → variante → unidad. Convive con /assets mientras dura la
# migración por tramos: éste sirve la carga, aquél sigue sirviendo préstamos,
# escaneo e inventario hasta el tramo siguiente.
api_router.include_router(catalogo.router)
api_router.include_router(import_catalogo.router)
api_router.include_router(proveedores.router)
# Conserva la ruta /assets/query para no reconfigurar el workflow de n8n
api_router.include_router(integraciones.router)
