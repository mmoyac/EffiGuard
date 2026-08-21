from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Cómo se entregó, que es lo que decide a quién le reclama el sistema:
#   plazo    la herramienta vuelve. Con fecha pactada, o con el límite del catálogo.
#   a_cargo  queda bajo la responsabilidad del operario hasta que la devuelva.
#            No hay fecha esperada y nunca aparece como vencida.
MODALIDAD_PLAZO = "plazo"
MODALIDAD_A_CARGO = "a_cargo"
MODALIDADES_VALIDAS = (MODALIDAD_PLAZO, MODALIDAD_A_CARGO)


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    # Se presta un EJEMPLAR, no un modelo: "este taladro", no "un taladro".
    unidad_id: Mapped[int] = mapped_column(ForeignKey("unidades.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))       # Operario que recibe
    bodeguero_id: Mapped[int] = mapped_column(ForeignKey("users.id"))  # Quien entrega
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    fecha_entrega: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fecha_devolucion_prevista: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Una columna y no la ausencia de `fecha_devolucion_prevista`: esa nulidad ya
    # significa "sin fecha pactada, rige el límite del catálogo", que es lo común.
    modalidad: Mapped[str] = mapped_column(String(10), default=MODALIDAD_PLAZO, server_default=MODALIDAD_PLAZO)
    fecha_devolucion_real: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    unidad: Mapped["Unidad"] = relationship(back_populates="loans")
    user: Mapped["User"] = relationship(back_populates="loans_received", foreign_keys=[user_id])
    bodeguero: Mapped["User"] = relationship(back_populates="loans_delivered", foreign_keys=[bodeguero_id])
    project: Mapped["Project | None"] = relationship(back_populates="loans")
