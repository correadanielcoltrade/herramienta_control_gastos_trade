from sqlalchemy import ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class NovedadSoporte(Base, TimestampMixin):
    """Archivo de soporte que Trade adjunta al documentar una novedad.

    El contenido se guarda en la BD y no en disco porque el hosting no tiene
    almacenamiento persistente entre despliegues; por eso el endpoint de carga
    limita el tamano y los formatos aceptados.

    Lo referencian tanto `novedad_resoluciones` (mientras la solicitud vive) como
    `novedad_bajas` (cuando OPS aprueba la baja y la resolucion se elimina), de
    modo que el soporte sobrevive al cierre de la novedad.
    """

    __tablename__ = "novedad_soportes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre_archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    tamano_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    contenido: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    subido_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    subido_por_nombre: Mapped[str | None] = mapped_column(String(120), nullable=True)

    subido_por: Mapped["User | None"] = relationship()
