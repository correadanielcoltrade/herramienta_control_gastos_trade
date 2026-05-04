from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Reception(Base, TimestampMixin):
    __tablename__ = "recepciones"
    __table_args__ = (Index("ux_recepciones_serial_id", "serial_id", unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False)
    cav_id: Mapped[int] = mapped_column(ForeignKey("cavs.id"), nullable=False, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    cav: Mapped["CAV"] = relationship()
    serial: Mapped["Serial"] = relationship(back_populates="recepciones")
    user: Mapped["User"] = relationship(back_populates="recepciones")
