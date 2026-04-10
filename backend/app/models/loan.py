from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))       # Operario que recibe
    bodeguero_id: Mapped[int] = mapped_column(ForeignKey("users.id"))  # Quien entrega
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    fecha_entrega: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fecha_devolucion_prevista: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_devolucion_real: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    asset: Mapped["Asset"] = relationship(back_populates="loans")
    user: Mapped["User"] = relationship(back_populates="loans_received", foreign_keys=[user_id])
    bodeguero: Mapped["User"] = relationship(back_populates="loans_delivered", foreign_keys=[bodeguero_id])
    project: Mapped["Project | None"] = relationship(back_populates="loans")
