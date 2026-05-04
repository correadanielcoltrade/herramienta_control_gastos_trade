from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Abastecimiento(Base, TimestampMixin):
    __tablename__ = "abastecimientos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False, index=True)
    descripcion_producto: Mapped[str] = mapped_column(String(255), nullable=False)
    cav_id: Mapped[int] = mapped_column(ForeignKey("cavs.id"), nullable=False, index=True)
    centro_costos_cav: Mapped[str] = mapped_column(String(120), nullable=False)
    fecha_envio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    serial: Mapped["Serial"] = relationship(back_populates="abastecimientos")
    cav: Mapped["CAV"] = relationship()
    user: Mapped["User"] = relationship(back_populates="abastecimientos")
