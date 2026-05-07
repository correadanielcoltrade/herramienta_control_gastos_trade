from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import MovementType, SerialStatus
from app.schemas.cav import CAVRead
from app.schemas.common import ORMModel


class SerialRead(ORMModel):
    id: int
    serial: str
    descripcion_producto: str | None = None
    cav_id: int | None = None
    current_status: SerialStatus
    last_movement_at: datetime | None = None
    cav: CAVRead | None = None


class AbastecimientoCreate(BaseModel):
    serial: str = Field(min_length=2, max_length=120)
    descripcion_producto: str = Field(min_length=2, max_length=255)
    numero_guia: str = Field(min_length=1, max_length=120)
    cav_id: int
    centro_costos_cav: str = Field(min_length=2, max_length=120)
    fecha_envio: datetime


class AbastecimientoUpdate(BaseModel):
    serial: str = Field(min_length=2, max_length=120)
    descripcion_producto: str = Field(min_length=2, max_length=255)
    numero_guia: str = Field(min_length=1, max_length=120)
    cav_id: int
    centro_costos_cav: str = Field(min_length=2, max_length=120)
    fecha_envio: datetime


class SupplyRead(BaseModel):
    id: int
    serial_id: int
    serial: str
    descripcion_producto: str
    numero_guia: str | None = None
    cav_id: int
    centro_costos_cav: str
    fecha_envio: datetime
    current_status: SerialStatus
    cav: CAVRead | None = None


class SupplyDeleteManyRequest(BaseModel):
    supply_ids: list[int] = Field(min_length=1)


class ReceptionBatchCreate(BaseModel):
    seriales: list[str] = Field(min_length=1)
    cav_id: int
    fecha: datetime


class BlockedSerial(BaseModel):
    serial: str
    cav_asignado_id: int
    cav_asignado_nombre: str


class ReceptionResult(BaseModel):
    procesados: list[SerialRead]
    pendientes: list[SerialRead]
    duplicados: list[str]
    bloqueados: list[BlockedSerial] = []


class ReceptionRead(BaseModel):
    id: int
    serial_id: int
    serial: str
    cav_id: int
    fecha: datetime
    confirmado_por: str
    cav: CAVRead | None = None


class LegalizationCreate(BaseModel):
    serial: str = Field(min_length=2, max_length=120)
    tipo_inventario: str = Field(min_length=2, max_length=255)
    tipo_uso: str = Field(min_length=2, max_length=120)
    cliente_asesor: str = Field(min_length=2, max_length=255)
    documento_cliente: str | None = Field(default=None, max_length=120)
    numero_factura: str = Field(min_length=1, max_length=120)
    firma: str = Field(min_length=10, max_length=2000000)
    asesor_responsable: str = Field(min_length=2, max_length=255)
    fecha: datetime


class LegalizationRead(ORMModel):
    id: int
    serial_id: int
    serial: str
    fecha: datetime
    tipo_inventario: str
    tipo_uso: str
    cliente_asesor: str
    documento_cliente: str | None = None
    numero_factura: str | None = None
    firma: str
    asesor_responsable: str
    registrado_por: str
    cav: CAVRead | None = None


class MarkDuplicateRequest(BaseModel):
    serial: str = Field(min_length=2, max_length=120)
    notes: str | None = Field(default=None, max_length=500)


class SerialMovementRead(ORMModel):
    id: int
    movement_type: MovementType
    previous_status: SerialStatus | None = None
    new_status: SerialStatus
    source_table: str
    source_id: int | None = None
    notes: str | None = None
    cav_id: int | None = None
    user_id: int | None = None
    created_at: datetime
