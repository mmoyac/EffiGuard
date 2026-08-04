"""
Catálogo de proveedores del tenant.

Existe para que un código pueda decir de quién viene, en vez de repetir el nombre
como texto en cada fila. No lleva precios ni condiciones: eso es compras.
"""
from fastapi import APIRouter, HTTPException, status

from app.core.dependencies import CurrentToken, DBSession
from app.repositories.codigo import CodigoRepository
from app.repositories.proveedor import ProveedorRepository
from app.schemas.catalogo import ProveedorCreate, ProveedorResponse, ProveedorUpdate

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])


@router.get("", response_model=list[ProveedorResponse])
async def list_proveedores(token: CurrentToken, session: DBSession):
    return await ProveedorRepository(session, token.tenant_id).list_all()


@router.post("", response_model=ProveedorResponse, status_code=status.HTTP_201_CREATED)
async def create_proveedor(data: ProveedorCreate, token: CurrentToken, session: DBSession):
    repo = ProveedorRepository(session, token.tenant_id)
    if await repo.get_by_nombre(data.nombre):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un proveedor '{data.nombre}'",
        )
    proveedor = await repo.create(nombre=data.nombre, rut=data.rut, contacto=data.contacto)
    await session.commit()
    return proveedor


@router.patch("/{proveedor_id}", response_model=ProveedorResponse)
async def update_proveedor(
    proveedor_id: int, data: ProveedorUpdate, token: CurrentToken, session: DBSession
):
    repo = ProveedorRepository(session, token.tenant_id)
    proveedor = await repo.get(proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")
    proveedor = await repo.update(proveedor, **data.model_dump(exclude_unset=True))
    await session.commit()
    return proveedor


@router.delete("/{proveedor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_proveedor(proveedor_id: int, token: CurrentToken, session: DBSession):
    """Los códigos bloquean el borrado; las compras ya registradas no.

    Un movimiento pasado conserva su cantidad y su costo aunque el proveedor
    desaparezca: sólo pierde la referencia (`ON DELETE SET NULL`).
    """
    repo = ProveedorRepository(session, token.tenant_id)
    proveedor = await repo.get(proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado")

    en_uso = await repo.contar_codigos(proveedor_id)
    if en_uso:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar: el proveedor tiene {en_uso} código(s) asociado(s)",
        )

    await repo.delete(proveedor)
    await session.commit()


@router.get("/de-variante/{variante_id}", response_model=list[ProveedorResponse])
async def proveedores_de_variante(variante_id: int, token: CurrentToken, session: DBSession):
    """Los proveedores que esa variante ya conoce, por sus propios códigos.

    Es lo que el formulario de compra ofrece como selección rápida cuando no se
    escaneó ningún código, para que el dato no quede sólo en las compras escaneadas.
    """
    ids = await CodigoRepository(session, token.tenant_id).proveedores_de_variante(variante_id)
    if not ids:
        return []
    repo = ProveedorRepository(session, token.tenant_id)
    return [p for p in await repo.list_all() if p.id in set(ids)]
