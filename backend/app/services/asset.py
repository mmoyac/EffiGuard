from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_state import AssetState
from app.repositories.asset import AssetRepository
from app.repositories.inventory_log import InventoryLogRepository
from app.repositories.loan import LoanRepository
from app.schemas.asset import AssetCreate, AssetUpdate, ConsumableWithdraw
from app.schemas.loan import LoanCreate


async def create_asset(data: AssetCreate, session: AsyncSession, tenant_id: int):
    repo = AssetRepository(session, tenant_id)
    return await repo.create(**data.model_dump())


async def update_asset(asset_id: int, data: AssetUpdate, session: AsyncSession, tenant_id: int):
    repo = AssetRepository(session, tenant_id)
    asset = await repo.get(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    return await repo.update(asset, **data.model_dump(exclude_none=True))


async def scan_asset(uid_fisico: str, session: AsyncSession, tenant_id: int):
    """Resolución de escaneo QR/RFID. Retorna el activo y sus hijos si es kit padre."""
    repo = AssetRepository(session, tenant_id)
    asset = await repo.get_by_uid(uid_fisico)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.parent_asset_id is None:
        # Cargar hijos si es kit padre
        return await repo.get_with_children(asset.id)
    return asset


async def withdraw_consumable(data: ConsumableWithdraw, session: AsyncSession, tenant_id: int, user_id: int):
    """Retira cantidad de un consumible: descuenta stock y genera log."""
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get(data.asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.tipo != "consumible":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El activo no es un consumible")
    if asset.stock_actual < data.cantidad:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock insuficiente")

    await asset_repo.update(asset, stock_actual=asset.stock_actual - data.cantidad)
    log = await log_repo.create(
        asset_id=data.asset_id,
        user_id=user_id,
        tipo_movimiento="entrega",
        cantidad=data.cantidad,
        observaciones=data.observaciones,
    )
    return log


async def create_loan(data: LoanCreate, session: AsyncSession, tenant_id: int, bodeguero_id: int):
    """Crea préstamo para herramienta o kit completo (padre → todos los hijos)."""
    asset_repo = AssetRepository(session, tenant_id)
    loan_repo = LoanRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    asset = await asset_repo.get_with_children(data.asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activo no encontrado")
    if asset.tipo != "herramienta":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use el endpoint de consumibles para retirar consumibles")

    # Préstamo activo previo
    if await loan_repo.get_active_by_asset(asset.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El activo ya tiene un préstamo activo")

    loans = []
    assets_to_loan = [asset] + list(asset.children)  # Kit: padre + hijos

    for a in assets_to_loan:
        loan = await loan_repo.create(
            asset_id=a.id,
            user_id=data.user_id,
            bodeguero_id=bodeguero_id,
            project_id=data.project_id,
            fecha_devolucion_prevista=data.fecha_devolucion_prevista,
        )
        # estado_id 2 = En Terreno
        await asset_repo.update(a, estado_id=2)
        await log_repo.create(
            asset_id=a.id,
            user_id=bodeguero_id,
            tipo_movimiento="entrega",
            cantidad=1,
        )
        loans.append(loan)

    return loans
