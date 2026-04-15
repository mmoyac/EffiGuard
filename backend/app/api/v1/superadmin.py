"""
Router exclusivo para Super Admin.
Prefijo: /api/v1/admin
Todos los endpoints requieren role_id == 1.
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete
import sqlalchemy as sa

from app.core.dependencies import DBSession
from app.core.security import hash_password
from app.core.superadmin import SuperAdminToken, ActingTenantId

from app.models.asset_family import AssetFamily
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role
from app.models.asset_state import AssetState
from app.models.module import Module
from app.models.menu_item import MenuItem
from app.models.role_menu_permission import RoleMenuPermission

router = APIRouter(prefix="/admin", tags=["SuperAdmin"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    nombre_empresa: str
    rut_empresa: str
    slug: str
    plan_type: str = "basic"

class TenantResponse(BaseModel):
    id: int
    nombre_empresa: str
    rut_empresa: str
    slug: str
    is_active: bool
    plan_type: str
    logo_url: str | None = None
    model_config = {"from_attributes": True}

class TenantUpdate(BaseModel):
    nombre_empresa: str | None = None
    plan_type: str | None = None
    is_active: bool | None = None


class GlobalUserCreate(BaseModel):
    tenant_id: int
    rut: str
    nombre: str
    email: EmailStr
    password: str
    role_id: int
    uid_credencial: str | None = None

class GlobalUserResponse(BaseModel):
    id: int
    tenant_id: int
    role_id: int
    rut: str
    nombre: str
    email: str
    uid_credencial: str | None
    is_active: bool
    model_config = {"from_attributes": True}

class GlobalUserUpdate(BaseModel):
    nombre: str | None = None
    email: EmailStr | None = None
    role_id: int | None = None
    is_active: bool | None = None
    uid_credencial: str | None = None


class RoleResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    model_config = {"from_attributes": True}


class AssetStateCreate(BaseModel):
    nombre: str

class AssetStateResponse(BaseModel):
    id: int
    nombre: str
    model_config = {"from_attributes": True}


class ModuleCreate(BaseModel):
    nombre: str
    icono: str | None = None
    orden: int = 0

class ModuleResponse(BaseModel):
    id: int
    nombre: str
    icono: str | None
    orden: int
    model_config = {"from_attributes": True}

class ModuleUpdate(BaseModel):
    nombre: str | None = None
    icono: str | None = None
    orden: int | None = None


class MenuItemCreate(BaseModel):
    module_id: int
    parent_id: int | None = None
    label: str
    ruta: str
    icono: str | None = None
    orden: int = 0

class MenuItemResponse(BaseModel):
    id: int
    module_id: int
    parent_id: int | None
    label: str
    ruta: str
    icono: str | None
    orden: int
    model_config = {"from_attributes": True}

class MenuItemUpdate(BaseModel):
    label: str | None = None
    ruta: str | None = None
    icono: str | None = None
    orden: int | None = None
    module_id: int | None = None
    parent_id: int | None = None


class PermissionSet(BaseModel):
    role_id: int
    menu_item_ids: list[int]

class PermissionResponse(BaseModel):
    id: int
    role_id: int
    menu_item_id: int
    model_config = {"from_attributes": True}


# ─── Tenants ──────────────────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[TenantResponse])
async def list_tenants(token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Tenant).order_by(Tenant.id))
    return result.scalars().all()


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(data: TenantCreate, token: SuperAdminToken, session: DBSession):
    tenant = Tenant(
        nombre_empresa=data.nombre_empresa,
        rut_empresa=data.rut_empresa,
        slug=data.slug,
        plan_type=data.plan_type,
    )
    session.add(tenant)
    await session.flush()
    await session.refresh(tenant)

    # Familias por defecto
    session.add(AssetFamily(tenant_id=tenant.id, nombre="Herramienta", comportamiento="prestable", color="blue"))
    session.add(AssetFamily(tenant_id=tenant.id, nombre="Consumible", comportamiento="consumible", color="orange"))

    await session.commit()
    await session.refresh(tenant)
    return tenant


@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: int, data: TenantUpdate, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(tenant, k, v)
    await session.commit()
    await session.refresh(tenant)
    return tenant


_LOGOS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "logos")
_ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}


@router.post("/tenants/{tenant_id}/logo", response_model=TenantResponse)
async def upload_tenant_logo(
    tenant_id: int,
    token: SuperAdminToken,
    session: DBSession,
    file: UploadFile = File(...),
):
    result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Use PNG, JPEG, WebP o SVG.")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"{tenant_id}_{uuid.uuid4().hex[:8]}.{ext}"

    os.makedirs(_LOGOS_DIR, exist_ok=True)
    dest = os.path.join(_LOGOS_DIR, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    # Eliminar logo anterior si existía
    if tenant.logo_url:
        old_filename = tenant.logo_url.split("/")[-1]
        old_path = os.path.join(_LOGOS_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    tenant.logo_url = f"/static/logos/{filename}"
    await session.commit()
    await session.refresh(tenant)
    return tenant


# ─── Usuarios globales ────────────────────────────────────────────────────────

@router.get("/users", response_model=list[GlobalUserResponse])
async def list_all_users(
    token: SuperAdminToken,
    session: DBSession,
    tenant_id: int | None = None,
):
    q = select(User).order_by(User.tenant_id, User.id)
    if tenant_id:
        q = q.where(User.tenant_id == tenant_id)
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/users", response_model=GlobalUserResponse, status_code=status.HTTP_201_CREATED)
async def create_global_user(data: GlobalUserCreate, token: SuperAdminToken, session: DBSession):
    user = User(
        tenant_id=data.tenant_id,
        rut=data.rut,
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
        role_id=data.role_id,
        uid_credencial=data.uid_credencial,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=GlobalUserResponse)
async def update_global_user(user_id: int, data: GlobalUserUpdate, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    await session.commit()
    await session.refresh(user)
    return user


# ─── Roles ────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Role).order_by(Role.id))
    return result.scalars().all()


# ─── Estados de activo ────────────────────────────────────────────────────────

@router.get("/asset-states", response_model=list[AssetStateResponse])
async def list_asset_states(token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(AssetState).order_by(AssetState.id))
    return result.scalars().all()


@router.post("/asset-states", response_model=AssetStateResponse, status_code=status.HTTP_201_CREATED)
async def create_asset_state(data: AssetStateCreate, token: SuperAdminToken, session: DBSession):
    state = AssetState(nombre=data.nombre)
    session.add(state)
    await session.commit()
    await session.refresh(state)
    return state


@router.patch("/asset-states/{state_id}", response_model=AssetStateResponse)
async def update_asset_state(state_id: int, data: AssetStateCreate, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(AssetState).where(AssetState.id == state_id))
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="Estado no encontrado")
    state.nombre = data.nombre
    await session.commit()
    await session.refresh(state)
    return state


@router.delete("/asset-states/{state_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset_state(state_id: int, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(AssetState).where(AssetState.id == state_id))
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="Estado no encontrado")
    await session.delete(state)
    await session.commit()


# ─── Módulos ──────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=list[ModuleResponse])
async def list_modules(token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Module).order_by(Module.orden))
    return result.scalars().all()


@router.post("/modules", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(data: ModuleCreate, token: SuperAdminToken, session: DBSession):
    module = Module(nombre=data.nombre, icono=data.icono, orden=data.orden)
    session.add(module)
    await session.commit()
    await session.refresh(module)
    return module


@router.patch("/modules/{module_id}", response_model=ModuleResponse)
async def update_module(module_id: int, data: ModuleUpdate, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(module, k, v)
    await session.commit()
    await session.refresh(module)
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(module_id: int, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado")
    await session.delete(module)
    await session.commit()


# ─── Ítems de menú ────────────────────────────────────────────────────────────

@router.get("/menu-items", response_model=list[MenuItemResponse])
async def list_menu_items(token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(MenuItem).order_by(MenuItem.orden))
    return result.scalars().all()


@router.post("/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_item(data: MenuItemCreate, token: SuperAdminToken, session: DBSession):
    item = MenuItem(
        module_id=data.module_id,
        parent_id=data.parent_id,
        label=data.label,
        ruta=data.ruta,
        icono=data.icono,
        orden=data.orden,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@router.patch("/menu-items/{item_id}", response_model=MenuItemResponse)
async def update_menu_item(item_id: int, data: MenuItemUpdate, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de menú no encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await session.commit()
    await session.refresh(item)
    return item


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(item_id: int, token: SuperAdminToken, session: DBSession):
    result = await session.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem de menú no encontrado")
    # Eliminar permisos asociados antes de borrar el ítem (FK constraint)
    await session.execute(delete(RoleMenuPermission).where(RoleMenuPermission.menu_item_id == item_id))
    await session.delete(item)
    await session.commit()


# ─── Permisos de menú por rol ─────────────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(token: SuperAdminToken, session: DBSession, role_id: int | None = None):
    q = select(RoleMenuPermission)
    if role_id:
        q = q.where(RoleMenuPermission.role_id == role_id)
    result = await session.execute(q)
    return result.scalars().all()


@router.put("/permissions", response_model=list[PermissionResponse])
async def set_permissions(data: PermissionSet, token: SuperAdminToken, session: DBSession):
    """Reemplaza todos los permisos de un rol con la lista enviada."""
    await session.execute(
        delete(RoleMenuPermission).where(RoleMenuPermission.role_id == data.role_id)
    )
    new_perms = [
        RoleMenuPermission(role_id=data.role_id, menu_item_id=mid)
        for mid in data.menu_item_ids
    ]
    session.add_all(new_perms)
    await session.commit()
    result = await session.execute(
        select(RoleMenuPermission).where(RoleMenuPermission.role_id == data.role_id)
    )
    return result.scalars().all()


# ─── Vista rápida de un tenant completo ───────────────────────────────────────

@router.get("/tenants/{tenant_id}/summary")
async def tenant_summary(tenant_id: int, token: SuperAdminToken, session: DBSession):
    """Resumen del tenant: usuarios, activos y préstamos activos."""
    from app.models.asset import Asset
    from app.models.loan import Loan

    tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    users_count = (await session.execute(
        sa.select(sa.func.count()).select_from(User).where(User.tenant_id == tenant_id)
    )).scalar()
    assets_count = (await session.execute(
        sa.select(sa.func.count()).select_from(Asset).where(Asset.tenant_id == tenant_id)
    )).scalar()
    loans_count = (await session.execute(
        sa.select(sa.func.count()).select_from(Loan)
        .where(Loan.tenant_id == tenant_id)
        .where(Loan.fecha_devolucion_real.is_(None))
    )).scalar()

    return {
        "tenant": {"id": tenant.id, "nombre_empresa": tenant.nombre_empresa, "slug": tenant.slug, "plan_type": tenant.plan_type, "is_active": tenant.is_active},
        "usuarios": users_count,
        "activos": assets_count,
        "prestamos_activos": loans_count,
    }
