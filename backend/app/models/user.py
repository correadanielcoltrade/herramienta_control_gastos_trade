from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre_usuario: Mapped[str] = mapped_column(String(120), nullable=False)
    correo: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False, index=True)
    cav_id: Mapped[int | None] = mapped_column(ForeignKey("cavs.id"), nullable=True, index=True)
    regional: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    role: Mapped["Role"] = relationship(back_populates="users")
    cav: Mapped["CAV | None"] = relationship(back_populates="users")
    abastecimientos: Mapped[list["Abastecimiento"]] = relationship(back_populates="user")
    recepciones: Mapped[list["Reception"]] = relationship(back_populates="user")
    legalizaciones: Mapped[list["Legalization"]] = relationship(back_populates="user")
    serial_movements: Mapped[list["SerialMovement"]] = relationship(back_populates="user")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(back_populates="user")

