from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.api.deps import has_global_cav_access, regional_scoped_cav_ids
from app.core.enums import SerialStatus
from app.models.abastecimiento import Abastecimiento
from app.models.legalization import Legalization
from app.models.reception import Reception
from app.models.serial import Serial
from app.models.user import User


def build_summary(
    db: Session,
    current_user: User,
    cav_id: int | None = None,
    status_filter: SerialStatus | None = None,
    user_id: int | None = None,
) -> dict:
    filters = []
    if cav_id:
        filters.append(Serial.cav_id == cav_id)
    if status_filter:
        filters.append(Serial.current_status == status_filter)
    if user_id:
        filters.append(Serial.created_by_id == user_id)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            filters.append(Serial.id == -1)
        else:
            filters.append(Serial.cav_id == current_user.cav_id)
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None:
        filters.append(Serial.cav_id.in_(regional_ids))

    stmt = select(
        func.count(Serial.id),
        func.coalesce(func.sum(case((Serial.current_status == SerialStatus.ENVIADO, 1), else_=0)), 0),
        func.coalesce(func.sum(case((Serial.current_status == SerialStatus.DISPONIBLE, 1), else_=0)), 0),
        func.coalesce(func.sum(case((Serial.current_status == SerialStatus.LEGALIZADO, 1), else_=0)), 0),
        func.coalesce(func.sum(case((Serial.current_status == SerialStatus.PENDIENTE, 1), else_=0)), 0),
        func.coalesce(func.sum(case((Serial.current_status == SerialStatus.DUPLICADO, 1), else_=0)), 0),
    )
    if filters:
        stmt = stmt.where(and_(*filters))
    row = db.execute(stmt).one()
    return {
        "total_seriales": row[0],
        "enviados": row[1],
        "disponibles": row[2],
        "legalizados": row[3],
        "pendientes": row[4],
        "duplicados": row[5],
    }


def build_series(
    db: Session,
    current_user: User,
    *,
    start_date: date | None = None,
    end_date: date | None = None,
    cav_id: int | None = None,
    status_filter: SerialStatus | None = None,
    user_id: int | None = None,
) -> list[dict]:
    supply_filters = []
    reception_filters = []
    legalization_filters = []
    if cav_id:
        supply_filters.append(Abastecimiento.cav_id == cav_id)
        reception_filters.append(Reception.cav_id == cav_id)
        legalization_filters.append(Serial.cav_id == cav_id)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            supply_filters.append(Abastecimiento.id == -1)
            reception_filters.append(Reception.id == -1)
            legalization_filters.append(Serial.id == -1)
        else:
            supply_filters.append(Abastecimiento.cav_id == current_user.cav_id)
            reception_filters.append(Reception.cav_id == current_user.cav_id)
            legalization_filters.append(Serial.cav_id == current_user.cav_id)
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None:
        supply_filters.append(Abastecimiento.cav_id.in_(regional_ids))
        reception_filters.append(Reception.cav_id.in_(regional_ids))
        legalization_filters.append(Serial.cav_id.in_(regional_ids))
    if user_id:
        supply_filters.append(Abastecimiento.usuario_id == user_id)
        reception_filters.append(Reception.usuario_id == user_id)
        legalization_filters.append(Legalization.usuario_id == user_id)
    if start_date:
        supply_filters.append(func.date(Abastecimiento.fecha_envio) >= start_date)
        reception_filters.append(func.date(Reception.fecha) >= start_date)
        legalization_filters.append(func.date(Legalization.fecha) >= start_date)
    if end_date:
        supply_filters.append(func.date(Abastecimiento.fecha_envio) <= end_date)
        reception_filters.append(func.date(Reception.fecha) <= end_date)
        legalization_filters.append(func.date(Legalization.fecha) <= end_date)

    supply_date = func.date(Abastecimiento.fecha_envio).label("fecha")
    supply_count = func.count(Abastecimiento.id).label("abastecimientos")
    supply_stmt = select(
        supply_date,
        supply_count,
    )
    if supply_filters:
        supply_stmt = supply_stmt.where(and_(*supply_filters))
    supply_rows = {
        row.fecha: row.abastecimientos
        for row in db.execute(supply_stmt.group_by(supply_date).order_by(supply_date))
    }

    reception_date = func.date(Reception.fecha).label("fecha")
    reception_count = func.count(Reception.id).label("recepciones")
    reception_stmt = select(
        reception_date,
        reception_count,
    )
    if reception_filters:
        reception_stmt = reception_stmt.where(and_(*reception_filters))
    reception_rows = {
        row.fecha: row.recepciones
        for row in db.execute(reception_stmt.group_by(reception_date).order_by(reception_date))
    }

    legalization_date = func.date(Legalization.fecha).label("fecha")
    legalization_count = func.count(Legalization.id).label("legalizados")
    legalization_stmt = select(
        legalization_date,
        legalization_count,
    ).join(Serial, Serial.id == Legalization.serial_id)
    if legalization_filters:
        legalization_stmt = legalization_stmt.where(and_(*legalization_filters))
    legalization_rows = {
        row.fecha: row.legalizados
        for row in db.execute(legalization_stmt.group_by(legalization_date).order_by(legalization_date))
    }

    available_date = func.date(Serial.updated_at).label("fecha")
    available_count = func.count(Serial.id).label("disponibles")
    available_by_date_stmt = select(
        available_date,
        available_count,
    ).where(Serial.current_status == SerialStatus.DISPONIBLE)
    if cav_id:
        available_by_date_stmt = available_by_date_stmt.where(Serial.cav_id == cav_id)
    if status_filter:
        available_by_date_stmt = available_by_date_stmt.where(Serial.current_status == status_filter)
    if user_id:
        available_by_date_stmt = available_by_date_stmt.where(Serial.created_by_id == user_id)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            available_by_date_stmt = available_by_date_stmt.where(Serial.id == -1)
        else:
            available_by_date_stmt = available_by_date_stmt.where(Serial.cav_id == current_user.cav_id)
    if regional_ids is not None:
        available_by_date_stmt = available_by_date_stmt.where(Serial.cav_id.in_(regional_ids))
    if start_date:
        available_by_date_stmt = available_by_date_stmt.where(func.date(Serial.updated_at) >= start_date)
    if end_date:
        available_by_date_stmt = available_by_date_stmt.where(func.date(Serial.updated_at) <= end_date)
    available_rows = {
        row.fecha: row.disponibles
        for row in db.execute(available_by_date_stmt.group_by(available_date).order_by(available_date))
    }

    all_dates = sorted(set(supply_rows) | set(reception_rows) | set(legalization_rows) | set(available_rows))
    return [
        {
            "fecha": current_date,
            "abastecimientos": supply_rows.get(current_date, 0),
            "recepciones": reception_rows.get(current_date, 0),
            "disponibles": available_rows.get(current_date, 0),
            "legalizados": legalization_rows.get(current_date, 0),
        }
        for current_date in all_dates
    ]
