from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import NovedadEstado
from app.models.base import Base, TimestampMixin


class NovedadResolucion(Base, TimestampMixin):
    """Solicitud de ingreso a abastecimiento para una novedad (serial recibido sin abastecimiento).

    La crea un usuario Trade/Admin al aprobar una novedad, con los datos del abastecimiento
    propuesto. Queda pendiente de aprobacion por OPS, que la concilia (la pasa a abastecimiento)
    o la rechaza.
    """

    __tablename__ = "novedad_resoluciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False, index=True)
    cav_id: Mapped[int] = mapped_column(ForeignKey("cavs.id"), nullable=False, index=True)
    estado: Mapped[str] = mapped_column(
        String(30), nullable=False, default=NovedadEstado.PENDIENTE_OPS.value, index=True
    )

    observacion_trade: Mapped[str] = mapped_column(Text, nullable=False)
    observacion_ops: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Datos del abastecimiento propuestos por Trade al aprobar la novedad.
    descripcion_producto: Mapped[str] = mapped_column(String(255), nullable=False)
    numero_guia: Mapped[str] = mapped_column(String(120), nullable=False)
    centro_costos_cav: Mapped[str] = mapped_column(String(120), nullable=False)
    fecha_envio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_entrega_pdv: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estado_entrega: Mapped[str | None] = mapped_column(String(50), nullable=True)

    creado_por_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    resuelto_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resuelto_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    abastecimiento_id: Mapped[int | None] = mapped_column(
        ForeignKey("abastecimientos.id"), nullable=True
    )

    serial: Mapped["Serial"] = relationship()
    cav: Mapped["CAV"] = relationship()
    creado_por: Mapped["User"] = relationship(foreign_keys=[creado_por_id])
    resuelto_por: Mapped["User | None"] = relationship(foreign_keys=[resuelto_por_id])
