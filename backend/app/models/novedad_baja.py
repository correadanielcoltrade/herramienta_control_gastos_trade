from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class NovedadBaja(Base, TimestampMixin):
    """Registro permanente de cada novedad dada de baja (eliminada del flujo).

    Como al dar de baja se elimina el serial de la BD, aqui se guarda una copia
    con el motivo, quien lo solicito y cuando (created_at), para trazabilidad y control.

    La baja solo se ejecuta cuando OPS aprueba la solicitud de Trade, por lo que se
    guardan los dos responsables: `usuario_*` (Trade, autor del motivo) y
    `aprobado_por_*` (OPS, que dio el visto bueno final).
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
    aprobado_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    aprobado_por_nombre: Mapped[str | None] = mapped_column(String(120), nullable=True)
    observacion_ops: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Se hereda de la resolucion al ejecutar la baja, para no perder la evidencia.
    soporte_id: Mapped[int | None] = mapped_column(
        ForeignKey("novedad_soportes.id"), nullable=True
    )

    cav: Mapped["CAV | None"] = relationship()
    soporte: Mapped["NovedadSoporte | None"] = relationship()
    usuario: Mapped["User | None"] = relationship(foreign_keys=[usuario_id])
    aprobado_por: Mapped["User | None"] = relationship(foreign_keys=[aprobado_por_id])
