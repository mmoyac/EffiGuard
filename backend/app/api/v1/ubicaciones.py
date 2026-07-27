"""
Catálogo de ubicaciones físicas de bodega.

Cada registro es una posición real (rack + nivel + posición). Los selectores en
cascada del frontend se derivan de este catálogo, no de tablas separadas: un
'nivel 5' no existe con independencia de su rack.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.ubicacion import UbicacionRepository
from app.schemas.ubicacion import UbicacionCreate, UbicacionResponse, UbicacionUpdate

router = APIRouter(prefix="/ubicaciones", tags=["Ubicaciones"])


@router.get("", response_model=list[UbicacionResponse])
async def list_ubicaciones(token: CurrentToken, session: DBSession):
    repo = UbicacionRepository(session, token.tenant_id)
    return await repo.list_all()


# ── Selectores en cascada ────────────────────────────────────────────────────
# Declarados antes que las rutas con parámetro para que no las capture /{id}.


@router.get("/racks", response_model=list[str])
async def list_racks(token: CurrentToken, session: DBSession):
    repo = UbicacionRepository(session, token.tenant_id)
    return await repo.racks()


@router.get("/niveles", response_model=list[str])
async def list_niveles(rack: str, token: CurrentToken, session: DBSession):
    repo = UbicacionRepository(session, token.tenant_id)
    return await repo.niveles(rack.strip().upper())


@router.get("/posiciones", response_model=list[UbicacionResponse])
async def list_posiciones(rack: str, nivel: str, token: CurrentToken, session: DBSession):
    repo = UbicacionRepository(session, token.tenant_id)
    return await repo.posiciones(rack.strip().upper(), nivel.strip().upper())


# ── CRUD ─────────────────────────────────────────────────────────────────────


@router.post("", response_model=UbicacionResponse, status_code=status.HTTP_201_CREATED)
async def create_ubicacion(data: UbicacionCreate, token: CurrentToken, session: DBSession):
    """Crea una posición. Si la terna ya existe, devuelve 409 con la existente
    para que el cliente pueda seleccionarla en vez de duplicarla."""
    repo = UbicacionRepository(session, token.tenant_id)

    existente = await repo.get_by_posicion(data.rack, data.nivel, data.posicion)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"La ubicación {data.rack} · {data.nivel} · {data.posicion} ya existe",
                "existente": UbicacionResponse.model_validate(existente).model_dump(),
            },
        )

    return await repo.create(
        rack=data.rack,
        nivel=data.nivel,
        posicion=data.posicion,
        descripcion=data.descripcion,
    )


@router.patch("/{ubicacion_id}", response_model=UbicacionResponse)
async def update_ubicacion(
    ubicacion_id: int, data: UbicacionUpdate, token: CurrentToken, session: DBSession
):
    """Renombrar aquí reubica de golpe a todos los activos asignados."""
    repo = UbicacionRepository(session, token.tenant_id)

    ubicacion = await repo.get(ubicacion_id)
    if not ubicacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")

    cambios = data.model_dump(exclude_unset=True)

    # Si cambia la terna, verificar que la nueva no choque con otra posición
    rack = cambios.get("rack", ubicacion.rack)
    nivel = cambios.get("nivel", ubicacion.nivel)
    posicion = cambios.get("posicion", ubicacion.posicion)
    if (rack, nivel, posicion) != (ubicacion.rack, ubicacion.nivel, ubicacion.posicion):
        choque = await repo.get_by_posicion(rack, nivel, posicion)
        if choque:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe la ubicación {rack} · {nivel} · {posicion}",
            )

    return await repo.update(ubicacion, **cambios)


@router.delete("/{ubicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ubicacion(ubicacion_id: int, token: CurrentToken, session: DBSession):
    repo = UbicacionRepository(session, token.tenant_id)

    ubicacion = await repo.get(ubicacion_id)
    if not ubicacion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")

    ocupada = await repo.contar_assets(ubicacion_id)
    if ocupada:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: la ubicación tiene {ocupada} activo(s) asignado(s)",
        )

    await repo.delete(ubicacion)
