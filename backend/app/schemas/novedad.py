from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.cav import CAVRead


class NovedadSoporteRead(BaseModel):
    """Metadatos del soporte adjunto; el archivo se descarga por su propio endpoint."""

    id: int
    nombre_archivo: str
    content_type: str
    tamano_bytes: int
    subido_por_nombre: str | None = None
    created_at: datetime


class SolicitarBajaRequest(BaseModel):
    """Trade solicita solucionar la novedad dando de baja el serial; la ejecuta OPS al aprobar."""

    observacion: str = Field(min_length=3, max_length=2000)
    # El soporte es obligatorio: Trade documenta y adjunta evidencia de la solucion.
    soporte_id: int


class AprobarNovedadRequest(BaseModel):
    observacion: str = Field(min_length=3, max_length=2000)
    descripcion_producto: str = Field(min_length=2, max_length=255)
    numero_guia: str = Field(min_length=1, max_length=120)
    # CAV de origen elegido por Trade. Si no viene, se conserva el del serial.
    cav_id: int | None = None
    # Opcional en esta rama: el ingreso a abastecimiento ya queda soportado por la guia.
    soporte_id: int | None = None
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
    # 'nueva'        = generada por el sistema, Trade puede actuar.
    # 'en_aprobacion'= ya enviada a OPS, en espera.
    # 'devuelta'     = OPS la rechazo y volvio a Trade para ajustarla.
    estado_resolucion: str
    resolucion_id: int | None = None
    # Tipo de la ultima solicitud ('ingreso' | 'baja'), este en aprobacion o devuelta.
    tipo_resolucion: str | None = None
    # Observacion del rechazo de OPS cuando la novedad esta devuelta.
    observacion_ops: str | None = None
    devuelta_por: str | None = None
    devuelta_at: datetime | None = None
    # Contexto de la recepcion, para que Trade pueda verificar con el asesor.
    recibido_por: str | None = None
    fecha_recepcion: datetime | None = None


class NovedadBajaRead(BaseModel):
    """Registro de una novedad dada de baja, para la tabla de trazabilidad."""

    id: int
    serial: str
    descripcion_producto: str | None = None
    cav_nombre: str | None = None
    motivo: str
    usuario_nombre: str
    aprobado_por_nombre: str | None = None
    observacion_ops: str | None = None
    soporte: NovedadSoporteRead | None = None
    created_at: datetime


class NovedadCerradaRead(BaseModel):
    """Novedad ya cerrada, por cualquiera de las dos ramas del flujo."""

    # Clave estable para el front: 'ingreso-12' / 'baja-3'.
    key: str
    serial: str
    cav_nombre: str | None = None
    # 'ingreso' = entro a abastecimiento del CAV; 'baja' = se soluciono sin ingresar.
    resultado: str
    observacion_trade: str
    observacion_ops: str | None = None
    solicitado_por: str | None = None
    aprobado_por: str | None = None
    soporte: NovedadSoporteRead | None = None
    cerrada_at: datetime | None = None


class NovedadResolucionRead(BaseModel):
    """Solicitud de Trade pendiente de OPS (ingreso a abastecimiento o baja del serial)."""

    id: int
    serial_id: int
    serial: str
    cav: CAVRead | None = None
    estado: str
    tipo: str
    observacion_trade: str
    observacion_ops: str | None = None
    # Solo vienen con datos en las solicitudes de tipo 'ingreso'.
    descripcion_producto: str | None = None
    numero_guia: str | None = None
    centro_costos_cav: str | None = None
    fecha_envio: datetime | None = None
    fecha_entrega_pdv: datetime | None = None
    estado_entrega: str | None = None
    creado_por: str | None = None
    soporte: NovedadSoporteRead | None = None
    created_at: datetime
