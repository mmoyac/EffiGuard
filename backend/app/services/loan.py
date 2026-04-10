from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.asset import AssetRepository
from app.repositories.inventory_log import InventoryLogRepository
from app.repositories.loan import LoanRepository


async def return_loan(loan_id: int, session: AsyncSession, tenant_id: int, user_id: int, observaciones: str | None = None):
    loan_repo = LoanRepository(session, tenant_id)
    asset_repo = AssetRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    loan = await loan_repo.get(loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Préstamo no encontrado")
    if loan.fecha_devolucion_real is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El préstamo ya fue devuelto")

    await loan_repo.return_loan(loan)

    # estado_id 1 = Disponible
    asset = await asset_repo.get(loan.asset_id)
    if asset:
        await asset_repo.update(asset, estado_id=1)

    await log_repo.create(
        asset_id=loan.asset_id,
        user_id=user_id,
        tipo_movimiento="devolucion",
        cantidad=1,
        observaciones=observaciones,
    )
    return loan
