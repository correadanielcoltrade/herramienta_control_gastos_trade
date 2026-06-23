from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.cav import CAVRead


class DarDeBajaRequest(BaseModel):
    observacion: str = Field(min_length=3, max_length=2000)


class AprobarNovedadRequest(BaseModel):
    observacion: str = Field(min_length=3, max_length=2000)
    descripcion_producto: str = Field(min_length=2, max_length=255)
    numero_guia: str = Field(min_length=1, max_length=120)
    centro_costos_cav: str | None = Field(default=None, max_length=120)
    fecha_envio: datetime
    fecha_entrega_pdv: datetime | None = None
    estado_entrega: str | None = Field(default=None, max_length=50)


class OpsResolverRequest(BaseModel):
    observacion: str | None = Field(default=None, max_length=2000)


class NovedadRead(BaseModel):
    """Novedad pendiente (serial recibido sin abastecimiento) para la vista de Trade/Admin."""

    serial_id: int
    serial: str
    descripcion_producto: str | None = None
    cav: CAVRead | None = None
    last_movement_at: datetime | None = None
    # 'nueva' = Trade puede actuar; 'en_aprobacion' = ya enviada a OPS, en espera.
    estado_resolucion: str
    resolucion_id: int | None = None
    # Ultima observacion de rechazo de OPS, si aplica.
    observacion_ops: str | None = None


class NovedadResolucionRead(BaseModel):
    """Solicitud de ingreso a abastecimiento para la bandeja de OPS."""

    id: int
    serial_id: int
    serial: str
    cav: CAVRead | None = None
    estado: str
    observacion_trade: str
    observacion_ops: str | None = None
    descripcion_producto: str
    numero_guia: str
    centro_costos_cav: str
    fecha_envio: datetime
    fecha_entrega_pdv: datetime | None = None
    estado_entrega: str | None = None
    creado_por: str | None = None
    created_at: datetime
