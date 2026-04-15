from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.asset_family import AssetFamilyRepository
from app.schemas.asset_family import AssetFamilyCreate, AssetFamilyResponse, AssetFamilyUpdate

router = APIRouter(prefix="/asset-families", tags=["Asset Families"])

_VALID_COMPORTAMIENTO = {"prestable", "consumible"}


@router.get("", response_model=list[AssetFamilyResponse])
async def list_families(token: CurrentToken, session: DBSession):
    repo = AssetFamilyRepository(session, token.tenant_id)
    return await repo.list()


_VALID_COLORS = {"blue", "orange", "green", "purple", "red", "yellow", "pink", "cyan"}


@router.post("", response_model=AssetFamilyResponse, status_code=status.HTTP_201_CREATED)
async def create_family(data: AssetFamilyCreate, token: CurrentToken, session: DBSession):
    if data.comportamiento not in _VALID_COMPORTAMIENTO:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="comportamiento debe ser 'prestable' o 'consumible'",
        )
    if data.color not in _VALID_COLORS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"color inválido. Opciones: {', '.join(sorted(_VALID_COLORS))}",
        )
    repo = AssetFamilyRepository(session, token.tenant_id)
    return await repo.create(nombre=data.nombre, comportamiento=data.comportamiento, color=data.color)


@router.patch("/{family_id}", response_model=AssetFamilyResponse)
async def update_family(family_id: int, data: AssetFamilyUpdate, token: CurrentToken, session: DBSession):
    repo = AssetFamilyRepository(session, token.tenant_id)
    family = await repo.get(family_id)
    if not family:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Familia no encontrada")
    await repo.update(family, **data.model_dump(exclude_unset=True))
    return family


@router.delete("/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_family(family_id: int, token: CurrentToken, session: DBSession):
    from sqlalchemy import select, func
    from app.models.asset import Asset

    repo = AssetFamilyRepository(session, token.tenant_id)
    family = await repo.get(family_id)
    if not family:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Familia no encontrada")

    # Verificar que no tenga activos asignados
    count = (await session.execute(
        select(func.count()).select_from(Asset).where(Asset.family_id == family_id)
    )).scalar()
    if count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: la familia tiene {count} activo(s) asignado(s)",
        )

    await repo.delete(family)
