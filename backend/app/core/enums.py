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


class MovementType(str, Enum):
    ABASTECIMIENTO = "abastecimiento"
    RECEPCION = "recepcion"
    DISPONIBILIDAD = "disponibilidad"
    LEGALIZACION = "legalizacion"
    DUPLICADO = "duplicado"
    AJUSTE = "ajuste"

