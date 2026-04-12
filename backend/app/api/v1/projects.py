from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.base import BaseRepository
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    nombre: str


class ProjectResponse(BaseModel):
    id: int
    tenant_id: int
    nombre: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProjectResponse])
async def list_projects(token: CurrentToken, session: DBSession):
    repo = BaseRepository(Project, session, token.tenant_id)
    return await repo.list()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, token: CurrentToken, session: DBSession):
    repo = BaseRepository(Project, session, token.tenant_id)
    return await repo.create(nombre=data.nombre)


@router.patch("/{project_id}/deactivate", response_model=ProjectResponse)
async def deactivate_project(project_id: int, token: CurrentToken, session: DBSession):
    repo = BaseRepository(Project, session, token.tenant_id)
    project = await repo.get(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return await repo.update(project, is_active=False)
