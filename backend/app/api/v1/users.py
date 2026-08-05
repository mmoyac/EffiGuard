from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentToken, DBSession
from app.core.errors import error_credencial_ocupada, error_usuario_duplicado
from app.core.security import hash_password
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    token: CurrentToken,
    session: DBSession,
    skip: int = 0,
    limit: int = 50,
    role_id: int | None = None,
):
    """Con `role_id` devuelve sólo ese rol.

    Lo usan los selectores que ofrecen operarios: sin el filtro, cada formulario
    tendría que traer la lista completa y filtrarla en el cliente, repitiendo en
    cada pantalla una regla que cambia con los roles.
    """
    repo = UserRepository(session, token.tenant_id)
    if role_id is not None:
        return await repo.list_by_role(role_id, offset=skip, limit=limit)
    return await repo.list(offset=skip, limit=limit)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, token: CurrentToken, session: DBSession):
    repo = UserRepository(session, token.tenant_id)
    if data.uid_credencial:
        portador = await repo.portador_de_credencial(data.uid_credencial)
        if portador:
            raise error_credencial_ocupada(portador.nombre)
    try:
        return await repo.create(
            rut=data.rut,
            nombre=data.nombre,
            email=data.email,
            password_hash=hash_password(data.password),
            role_id=data.role_id,
            uid_credencial=data.uid_credencial,
        )
    except IntegrityError as e:
        # Red ante dos guardados simultáneos: entre la consulta de arriba y este
        # commit cabe otro que se lleve la misma credencial.
        raise error_usuario_duplicado(e, "Error al crear usuario")


@router.get("/scan/{uid_credencial}", response_model=UserResponse)
async def scan_user(uid_credencial: str, token: CurrentToken, session: DBSession):
    """Resuelve un operario por su credencial RFID/QR. Usado para confirmar recepción de préstamo."""
    repo = UserRepository(session, token.tenant_id)
    user = await repo.get_by_credential_uid(uid_credencial)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credencial no encontrada")
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, token: CurrentToken, session: DBSession):
    repo = UserRepository(session, token.tenant_id)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, data: UserUpdate, token: CurrentToken, session: DBSession):
    repo = UserRepository(session, token.tenant_id)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    update_data = data.model_dump(exclude_none=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    if update_data.get("uid_credencial"):
        portador = await repo.portador_de_credencial(
            update_data["uid_credencial"], excluir_id=user.id
        )
        if portador:
            raise error_credencial_ocupada(portador.nombre)
    try:
        return await repo.update(user, **update_data)
    except IntegrityError as e:
        raise error_usuario_duplicado(e, "Error al actualizar usuario")
