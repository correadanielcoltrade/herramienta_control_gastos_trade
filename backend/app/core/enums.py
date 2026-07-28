from enum import Enum


class RoleName(str, Enum):
    SUPERADMIN = "SuperAdmin"
    OPS = "OPS"
    QUALITY = "Quality"
    TRADE = "Trade"
    TRADE_LEADER = "Trade Leader"
    TRADE_MANAGER = "Trade Manager"
    ASESOR = "Asesor"
    SUPERNUMERARIO = "Supernumerario"


class SerialStatus(str, Enum):
    ENVIADO = "enviado"
    RECIBIDO = "recibido"
    DISPONIBLE = "disponible"
    GASTADO = "gastado"
    LEGALIZADO = "legalizado"
    DUPLICADO = "duplicado"
    PENDIENTE = "pendiente"


class NovedadEstado(str, Enum):
    PENDIENTE_OPS = "pendiente_ops"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"


class NovedadTipo(str, Enum):
    """Que solicita Trade sobre la novedad; OPS es el filtro final en ambos casos."""

    INGRESO = "ingreso"  # Ingresar el serial a abastecimiento.
    BAJA = "baja"  # Solucionar la novedad eliminando el serial.


class MovementType(str, Enum):
    ABASTECIMIENTO = "abastecimiento"
    RECEPCION = "recepcion"
    DISPONIBILIDAD = "disponibilidad"
    LEGALIZACION = "legalizacion"
    DUPLICADO = "duplicado"
    AJUSTE = "ajuste"

