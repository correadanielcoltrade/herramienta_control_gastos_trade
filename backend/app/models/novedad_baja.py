from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class NovedadBaja(Base, TimestampMixin):
    """Registro permanente de cada novedad dada de baja (eliminada del flujo).

    Como al dar de baja se elimina el serial de la BD, aqui se guarda una copia
    con el motivo, quien lo hizo y cuando (created_at), para trazabilidad y control.
    """

    __tablename__ = "novedad_bajas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    descripcion_producto: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cav_id: Mapped[int | None] = mapped_column(ForeignKey("cavs.id"), nullable=True, index=True)
    cav_nombre: Mapped[str | None] = mapped_column(String(120), nullable=True)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    usuario_nombre: Mapped[str] = mapped_column(String(120), nullable=False)

    cav: Mapped["CAV | None"] = relationship()
    usuario: Mapped["User | None"] = relationship()
