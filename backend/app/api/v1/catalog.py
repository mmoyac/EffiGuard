"""
Endpoints de catálogo: marcas, modelos y estados de activo.
Necesarios para poder crear activos desde el frontend.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import CurrentToken, DBSession
from app.models.asset_state import AssetState
from app.models.brand import Brand
from sqlalchemy import select

router = APIRouter(prefix="/catalog", tags=["Catalog"])


# ── Schemas inline (simples, no justifican archivo propio) ────────────────────

class BrandCreate(BaseModel):
    nombre: str

class BrandResponse(BaseModel):
    id: int; tenant_id: int; nombre: str
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



@router.get("/states", response_model=list[StateResponse])
async def list_states(token: CurrentToken, session: DBSession):
    result = await session.execute(select(AssetState))
    return list(result.scalars().all())
