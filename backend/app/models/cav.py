from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CAV(Base, TimestampMixin):
    __tablename__ = "cavs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre_cav: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    centro_costos: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    regional: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="cav")
    serials: Mapped[list["Serial"]] = relationship(back_populates="cav")

