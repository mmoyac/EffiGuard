from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.asset import AssetRepository
from app.repositories.inventory_log import InventoryLogRepository
from app.repositories.loan import LoanRepository


async def return_loan(loan_id: int, session: AsyncSession, tenant_id: int, user_id: int, returning_user_id: int, observaciones: str | None = None):
    loan_repo = LoanRepository(session, tenant_id)
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    loan = await loan_repo.get(loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Préstamo no encontrado")
    if loan.fecha_devolucion_real is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El préstamo ya fue devuelto")
    if loan.user_id != returning_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El operario no coincide con quien retiró la herramienta")

    await loan_repo.return_loan(loan)

    # estado_id 1 = Disponible
    asset = await asset_repo.get_with_children(loan.asset_id)
    if asset:
        await asset_repo.update(asset, estado_id=1)
        await log_repo.create(
            asset_id=asset.id,
            user_id=user_id,
            tipo_movimiento="devolucion",
            cantidad=1,
            observaciones=observaciones,
        )

        # Si es kit padre, devolver también los préstamos activos de todos los hijos
        for child in asset.children:
            child_loan = await loan_repo.get_active_by_asset(child.id)
            if child_loan:
                await loan_repo.return_loan(child_loan)
                await asset_repo.update(child, estado_id=1)
                await log_repo.create(
                    asset_id=child.id,
                    user_id=user_id,
                    tipo_movimiento="devolucion",
                    cantidad=1,
                    observaciones=observaciones,
                )

    return loan
