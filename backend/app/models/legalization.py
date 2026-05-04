from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Legalization(Base, TimestampMixin):
    __tablename__ = "legalizaciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False, index=True)
    tipo_inventario: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo_uso: Mapped[str] = mapped_column(String(120), nullable=False)
    material: Mapped[str] = mapped_column(String(255), nullable=False)
    cantidad: Mapped[int] = mapped_column(nullable=False)
    cliente_asesor: Mapped[str] = mapped_column(String(255), nullable=False)
    documento_cliente: Mapped[str | None] = mapped_column(String(120))
    firma: Mapped[str] = mapped_column(Text, nullable=False)
    asesor_responsable: Mapped[str] = mapped_column(String(255), nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    serial: Mapped["Serial"] = relationship(back_populates="legalizaciones")
    user: Mapped["User"] = relationship(back_populates="legalizaciones")
