from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.enums import SerialStatus
from app.models.base import Base, TimestampMixin


serial_status_enum = Enum(
    SerialStatus,
    name="serial_status",
    schema=settings.db_schema,
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class Serial(Base, TimestampMixin):
    __tablename__ = "serials"
    __table_args__ = (
        Index("ix_serials_serial_unique", "serial", unique=True),
        Index("ix_serials_status_cav", "current_status", "cav_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion_producto: Mapped[str | None] = mapped_column(String(255))
    cav_id: Mapped[int | None] = mapped_column(ForeignKey("cavs.id"), nullable=True, index=True)
    current_status: Mapped[SerialStatus] = mapped_column(
        serial_status_enum,
        nullable=False,
        index=True,
    )
    last_movement_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    cav: Mapped["CAV | None"] = relationship(back_populates="serials")
    movements: Mapped[list["SerialMovement"]] = relationship(back_populates="serial", passive_deletes=True)
    abastecimientos: Mapped[list["Abastecimiento"]] = relationship(back_populates="serial", passive_deletes=True)
    recepciones: Mapped[list["Reception"]] = relationship(back_populates="serial", passive_deletes=True)
    legalizaciones: Mapped[list["Legalization"]] = relationship(back_populates="serial", passive_deletes=True)
