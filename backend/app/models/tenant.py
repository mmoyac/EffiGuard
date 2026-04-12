from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre_empresa: Mapped[str] = mapped_column(String(200))
    rut_empresa: Mapped[str] = mapped_column(String(20), unique=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan_type: Mapped[str] = mapped_column(String(20), default="basic")  # basic, pro, enterprise
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    assets: Mapped[list["Asset"]] = relationship(back_populates="tenant")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="tenant")
