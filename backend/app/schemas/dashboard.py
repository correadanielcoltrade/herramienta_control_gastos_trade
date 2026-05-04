from datetime import date

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_seriales: int
    enviados: int
    disponibles: int
    legalizados: int
    pendientes: int
    duplicados: int


class DashboardPoint(BaseModel):
    fecha: date
    abastecimientos: int = 0
    recepciones: int = 0
    disponibles: int = 0
    legalizados: int = 0


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    series: list[DashboardPoint]
