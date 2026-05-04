from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.enums import MovementType, SerialStatus
from app.models.base import Base, TimestampMixin


movement_type_enum = Enum(
    MovementType,
    name="movement_type",
    schema=settings.db_schema,
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)

serial_status_enum = Enum(
    SerialStatus,
    name="serial_status",
    schema=settings.db_schema,
    values_callable=lambda enum_cls: [item.value for item in enum_cls],
)


class SerialMovement(Base, TimestampMixin):
    __tablename__ = "serial_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False, index=True)
    movement_type: Mapped[MovementType] = mapped_column(movement_type_enum, nullable=False)
    previous_status: Mapped[SerialStatus | None] = mapped_column(serial_status_enum, nullable=True)
    new_status: Mapped[SerialStatus] = mapped_column(serial_status_enum, nullable=False, index=True)
    source_table: Mapped[str] = mapped_column(String(60), nullable=False)
    source_id: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)
    cav_id: Mapped[int | None] = mapped_column(ForeignKey("cavs.id"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    serial: Mapped["Serial"] = relationship(back_populates="movements")
    user: Mapped["User | None"] = relationship(back_populates="serial_movements")
