from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_id: Mapped[int | None] = mapped_column(nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64))

    user: Mapped["User | None"] = relationship(back_populates="audit_logs")
