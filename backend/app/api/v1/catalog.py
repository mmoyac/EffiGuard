"""
Endpoints de catálogo: marcas, modelos y estados de activo.
Necesarios para poder crear activos desde el frontend.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset_state import AssetState
from app.models.asset_model import AssetModel
from app.models.brand import Brand
from app.repositories.base import BaseRepository
from sqlalchemy import select

router = APIRouter(prefix="/catalog", tags=["Catalog"])


# ── Schemas inline (simples, no justifican archivo propio) ────────────────────

class BrandCreate(BaseModel):
    nombre: str

class BrandResponse(BaseModel):
    id: int; tenant_id: int; nombre: str
    model_config = {"from_attributes": True}

class ModelCreate(BaseModel):
    brand_id: int; nombre: str

class ModelResponse(BaseModel):
    id: int; tenant_id: int; brand_id: int; nombre: str
    model_config = {"from_attributes": True}

class StateResponse(BaseModel):
    id: int; nombre: str
    model_config = {"from_attributes": True}


# ── Brands ────────────────────────────────────────────────────────────────────

@router.get("/brands", response_model=list[BrandResponse])
async def list_brands(token: CurrentToken, session: DBSession):
    repo = BaseRepository(Brand, session, token.tenant_id)
    return await repo.list(limit=200)

@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(data: BrandCreate, token: CurrentToken, session: DBSession):
    repo = BaseRepository(Brand, session, token.tenant_id)
    return await repo.create(nombre=data.nombre)


# ── Models ────────────────────────────────────────────────────────────────────

@router.get("/models", response_model=list[ModelResponse])
async def list_models(token: CurrentToken, session: DBSession, brand_id: int | None = None):
    from sqlalchemy import select
    query = select(AssetModel).where(AssetModel.tenant_id == token.tenant_id)
    if brand_id:
        query = query.where(AssetModel.brand_id == brand_id)
    result = await session.execute(query)
    return list(result.scalars().all())

@router.post("/models", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(data: ModelCreate, token: CurrentToken, session: DBSession):
    repo = BaseRepository(AssetModel, session, token.tenant_id)
    return await repo.create(brand_id=data.brand_id, nombre=data.nombre)


# ── Asset states (globales, sin tenant) ──────────────────────────────────────

@router.get("/states", response_model=list[StateResponse])
async def list_states(token: CurrentToken, session: DBSession):
    result = await session.execute(select(AssetState))
    return list(result.scalars().all())
