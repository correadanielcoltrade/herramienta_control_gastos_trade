from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import NovedadEstado, NovedadTipo
from app.models.base import Base, TimestampMixin


class NovedadResolucion(Base, TimestampMixin):
    """Solicitud de Trade sobre una novedad (serial recibido sin abastecimiento).

    La crea un usuario Trade/Admin y queda pendiente de aprobacion por OPS, que es el
    filtro final. Segun `tipo`:

    - `ingreso`: Trade propone los datos del abastecimiento; al aprobar, OPS lo ingresa.
    - `baja`: Trade solicita solucionar la novedad eliminando el serial; al aprobar, OPS
      ejecuta la baja y queda el registro en `novedad_bajas`.

    Si OPS rechaza, en ambos casos la novedad vuelve a quedar disponible para Trade con
    la observacion del rechazo.
    """

    __tablename__ = "novedad_resoluciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    serial_id: Mapped[int] = mapped_column(ForeignKey("serials.id"), nullable=False, index=True)
    cav_id: Mapped[int] = mapped_column(ForeignKey("cavs.id"), nullable=False, index=True)
    estado: Mapped[str] = mapped_column(
        String(30), nullable=False, default=NovedadEstado.PENDIENTE_OPS.value, index=True
    )
    tipo: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NovedadTipo.INGRESO.value, index=True
    )

    observacion_trade: Mapped[str] = mapped_column(Text, nullable=False)
    observacion_ops: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Datos del abastecimiento propuestos por Trade. Solo aplican al tipo 'ingreso';
    # las solicitudes de baja no los traen.
    descripcion_producto: Mapped[str | None] = mapped_column(String(255), nullable=True)
    numero_guia: Mapped[str | None] = mapped_column(String(120), nullable=True)
    centro_costos_cav: Mapped[str | None] = mapped_column(String(120), nullable=True)
    fecha_envio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_entrega_pdv: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estado_entrega: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Soporte que Trade adjunta al documentar la novedad (obligatorio al solicitar la baja).
    soporte_id: Mapped[int | None] = mapped_column(
        ForeignKey("novedad_soportes.id"), nullable=True
    )

    creado_por_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    resuelto_por_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resuelto_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    abastecimiento_id: Mapped[int | None] = mapped_column(
        ForeignKey("abastecimientos.id"), nullable=True
    )

    serial: Mapped["Serial"] = relationship()
    cav: Mapped["CAV"] = relationship()
    soporte: Mapped["NovedadSoporte | None"] = relationship()
    creado_por: Mapped["User"] = relationship(foreign_keys=[creado_por_id])
    resuelto_por: Mapped["User | None"] = relationship(foreign_keys=[resuelto_por_id])
