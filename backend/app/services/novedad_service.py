from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import cav_ids_for_regional, regional_scoped_cav_ids
from app.core.config import settings
from app.core.enums import NovedadEstado, RoleName, SerialStatus
from app.core.errors import ApiError
from app.models.cav import CAV
from app.models.novedad_resolucion import NovedadResolucion
from app.models.reception import Reception
from app.models.role import Role
from app.models.serial import Serial
from app.models.serial_movement import SerialMovement
from app.models.user import User
from app.schemas.cav import CAVRead
from app.schemas.novedad import AprobarNovedadRequest, NovedadRead, NovedadResolucionRead
from app.schemas.serial import AbastecimientoCreate
from app.services.audit_service import register_audit_log
from app.services.email_service import EmailService
from app.services.serial_service import register_supply


def _ensure_novedad_in_scope(current_user: User, serial: Serial, db: Session) -> None:
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None and serial.cav_id not in regional_ids:
        raise ApiError("Esta novedad no pertenece a tus regionales.", 403)


def _get_novedad(db: Session, serial_id: int) -> Serial:
    serial = db.scalar(
        select(Serial).options(joinedload(Serial.cav)).where(Serial.id == serial_id)
    )
    if not serial or serial.current_status != SerialStatus.PENDIENTE:
        raise ApiError("Novedad no encontrada o ya no esta en estado pendiente.", 404)
    return serial


def list_novedades(
    db: Session, *, current_user: User, cav_id: int | None = None, regional: str | None = None
) -> list[NovedadRead]:
    stmt = (
        select(Serial)
        .options(joinedload(Serial.cav))
        .where(Serial.current_status == SerialStatus.PENDIENTE)
        .order_by(Serial.last_movement_at.desc().nullslast(), Serial.id.desc())
    )
    if cav_id:
        stmt = stmt.where(Serial.cav_id == cav_id)
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None:
        stmt = stmt.where(Serial.cav_id.in_(regional_ids))
    regional_filter_ids = cav_ids_for_regional(db, regional)
    if regional_filter_ids is not None:
        stmt = stmt.where(Serial.cav_id.in_(regional_filter_ids))
    serials = list(db.scalars(stmt))

    serial_ids = [serial.id for serial in serials]
    pending: dict[int, NovedadResolucion] = {}
    last_rejected: dict[int, NovedadResolucion] = {}
    if serial_ids:
        resoluciones = list(
            db.scalars(
                select(NovedadResolucion)
                .where(NovedadResolucion.serial_id.in_(serial_ids))
                .order_by(NovedadResolucion.id.desc())
            )
        )
        for resolucion in resoluciones:
            if resolucion.estado == NovedadEstado.PENDIENTE_OPS.value:
                pending.setdefault(resolucion.serial_id, resolucion)
            elif resolucion.estado == NovedadEstado.RECHAZADA.value:
                last_rejected.setdefault(resolucion.serial_id, resolucion)

    items: list[NovedadRead] = []
    for serial in serials:
        en_aprobacion = pending.get(serial.id)
        rechazada = last_rejected.get(serial.id)
        items.append(
            NovedadRead(
                serial_id=serial.id,
                serial=serial.serial,
                descripcion_producto=serial.descripcion_producto,
                cav=CAVRead.model_validate(serial.cav) if serial.cav else None,
                last_movement_at=serial.last_movement_at,
                estado_resolucion="en_aprobacion" if en_aprobacion else "nueva",
                resolucion_id=en_aprobacion.id if en_aprobacion else None,
                observacion_ops=rechazada.observacion_ops if (rechazada and not en_aprobacion) else None,
            )
        )
    return items


def dar_de_baja(db: Session, *, serial_id: int, observacion: str, current_user: User) -> None:
    serial = _get_novedad(db, serial_id)
    _ensure_novedad_in_scope(current_user, serial, db)
    if not observacion or not observacion.strip():
        raise ApiError("La observacion es obligatoria.", 400)

    serial_code = serial.serial
    db.execute(delete(NovedadResolucion).where(NovedadResolucion.serial_id == serial_id))
    db.execute(delete(SerialMovement).where(SerialMovement.serial_id == serial_id))
    db.execute(delete(Reception).where(Reception.serial_id == serial_id))
    register_audit_log(
        db,
        action="novedad_dar_de_baja",
        entity="serial",
        entity_id=serial_id,
        user_id=current_user.id,
        payload={"serial": serial_code, "observacion": observacion.strip()},
    )
    db.delete(serial)
    db.commit()


def aprobar_novedad(
    db: Session, *, serial_id: int, payload: AprobarNovedadRequest, current_user: User
) -> NovedadResolucion:
    serial = _get_novedad(db, serial_id)
    _ensure_novedad_in_scope(current_user, serial, db)
    if serial.cav_id is None or serial.cav is None:
        raise ApiError("La novedad no tiene un CAV asignado.", 400)

    ya_pendiente = db.scalar(
        select(NovedadResolucion).where(
            NovedadResolucion.serial_id == serial_id,
            NovedadResolucion.estado == NovedadEstado.PENDIENTE_OPS.value,
        )
    )
    if ya_pendiente:
        raise ApiError("Esta novedad ya esta en aprobacion por OPS.", 409)

    centro_costos = (payload.centro_costos_cav or serial.cav.centro_costos or "").strip()
    if not centro_costos:
        raise ApiError("Falta el centro de costos del CAV.", 400)

    resolucion = NovedadResolucion(
        serial_id=serial.id,
        cav_id=serial.cav_id,
        estado=NovedadEstado.PENDIENTE_OPS.value,
        observacion_trade=payload.observacion.strip(),
        descripcion_producto=payload.descripcion_producto.strip(),
        numero_guia=payload.numero_guia.strip(),
        centro_costos_cav=centro_costos,
        fecha_envio=payload.fecha_envio,
        fecha_entrega_pdv=payload.fecha_entrega_pdv,
        estado_entrega=payload.estado_entrega,
        creado_por_id=current_user.id,
    )
    db.add(resolucion)
    register_audit_log(
        db,
        action="novedad_aprobar",
        entity="serial",
        entity_id=serial.id,
        user_id=current_user.id,
        payload={"serial": serial.serial, "observacion": payload.observacion.strip()},
    )
    db.commit()
    db.refresh(resolucion)
    _notify_ops(db, resolucion=resolucion, serial=serial, creado_por=current_user)
    return resolucion


def list_aprobaciones_ops(db: Session) -> list[NovedadResolucionRead]:
    resoluciones = list(
        db.scalars(
            select(NovedadResolucion)
            .options(
                joinedload(NovedadResolucion.serial),
                joinedload(NovedadResolucion.cav),
                joinedload(NovedadResolucion.creado_por),
            )
            .where(NovedadResolucion.estado == NovedadEstado.PENDIENTE_OPS.value)
            .order_by(NovedadResolucion.created_at.asc())
        )
    )
    return [_serialize_resolucion(resolucion) for resolucion in resoluciones]


def ops_aprobar(
    db: Session, *, resolucion_id: int, observacion: str | None, current_user: User
) -> NovedadResolucion:
    resolucion = db.scalar(
        select(NovedadResolucion)
        .options(joinedload(NovedadResolucion.serial))
        .where(NovedadResolucion.id == resolucion_id)
    )
    if not resolucion or resolucion.estado != NovedadEstado.PENDIENTE_OPS.value:
        raise ApiError("Solicitud no encontrada o ya resuelta.", 404)

    supply = register_supply(
        db,
        AbastecimientoCreate(
            serial=resolucion.serial.serial,
            descripcion_producto=resolucion.descripcion_producto,
            numero_guia=resolucion.numero_guia,
            cav_id=resolucion.cav_id,
            centro_costos_cav=resolucion.centro_costos_cav,
            fecha_envio=resolucion.fecha_envio,
            fecha_entrega_pdv=resolucion.fecha_entrega_pdv,
            estado_entrega=resolucion.estado_entrega,
        ),
        current_user,
    )

    resolucion.estado = NovedadEstado.APROBADA.value
    resolucion.observacion_ops = (observacion or "").strip() or None
    resolucion.resuelto_por_id = current_user.id
    resolucion.resuelto_at = datetime.now(UTC)
    resolucion.abastecimiento_id = supply.id
    register_audit_log(
        db,
        action="novedad_ops_aprobar",
        entity="novedad_resolucion",
        entity_id=resolucion.id,
        user_id=current_user.id,
        payload={"serial": resolucion.serial.serial, "abastecimiento_id": supply.id},
    )
    db.commit()
    db.refresh(resolucion)
    return resolucion


def ops_rechazar(
    db: Session, *, resolucion_id: int, observacion: str | None, current_user: User
) -> NovedadResolucion:
    if not observacion or not observacion.strip():
        raise ApiError("La observacion es obligatoria para rechazar.", 400)
    resolucion = db.scalar(
        select(NovedadResolucion).where(NovedadResolucion.id == resolucion_id)
    )
    if not resolucion or resolucion.estado != NovedadEstado.PENDIENTE_OPS.value:
        raise ApiError("Solicitud no encontrada o ya resuelta.", 404)

    resolucion.estado = NovedadEstado.RECHAZADA.value
    resolucion.observacion_ops = observacion.strip()
    resolucion.resuelto_por_id = current_user.id
    resolucion.resuelto_at = datetime.now(UTC)
    register_audit_log(
        db,
        action="novedad_ops_rechazar",
        entity="novedad_resolucion",
        entity_id=resolucion.id,
        user_id=current_user.id,
        payload={"observacion": observacion.strip()},
    )
    db.commit()
    db.refresh(resolucion)
    return resolucion


def serialize_resolucion(db: Session, resolucion: NovedadResolucion) -> NovedadResolucionRead:
    full = db.scalar(
        select(NovedadResolucion)
        .options(
            joinedload(NovedadResolucion.serial),
            joinedload(NovedadResolucion.cav),
            joinedload(NovedadResolucion.creado_por),
        )
        .where(NovedadResolucion.id == resolucion.id)
    )
    return _serialize_resolucion(full or resolucion)


def _serialize_resolucion(resolucion: NovedadResolucion) -> NovedadResolucionRead:
    return NovedadResolucionRead(
        id=resolucion.id,
        serial_id=resolucion.serial_id,
        serial=resolucion.serial.serial if resolucion.serial else "",
        cav=CAVRead.model_validate(resolucion.cav) if resolucion.cav else None,
        estado=resolucion.estado,
        observacion_trade=resolucion.observacion_trade,
        observacion_ops=resolucion.observacion_ops,
        descripcion_producto=resolucion.descripcion_producto,
        numero_guia=resolucion.numero_guia,
        centro_costos_cav=resolucion.centro_costos_cav,
        fecha_envio=resolucion.fecha_envio,
        fecha_entrega_pdv=resolucion.fecha_entrega_pdv,
        estado_entrega=resolucion.estado_entrega,
        creado_por=resolucion.creado_por.nombre_usuario if resolucion.creado_por else None,
        created_at=resolucion.created_at,
    )


def _notify_ops(db: Session, *, resolucion: NovedadResolucion, serial: Serial, creado_por: User) -> None:
    """Envia correo a los usuarios OPS activos avisando de una novedad pendiente de aprobacion."""
    try:
        ops_emails = list(
            db.scalars(
                select(User.correo)
                .join(Role, Role.id == User.role_id)
                .where(
                    func.lower(func.trim(Role.name)) == RoleName.OPS.value.casefold(),
                    User.is_active.is_(True),
                )
            )
        )
        if not ops_emails:
            return
        app_link = f"{settings.frontend_url.rstrip('/')}/novedades"
        for correo in ops_emails:
            EmailService.send_novedad_pendiente_ops(
                recipient_email=correo,
                serial=serial.serial,
                cav_nombre=serial.cav.nombre_cav if serial.cav else "Sin CAV",
                descripcion=resolucion.descripcion_producto,
                creado_por=creado_por.nombre_usuario,
                app_link=app_link,
            )
    except Exception as exc:  # noqa: BLE001 - el correo no debe romper el flujo
        print(f"Error notificando a OPS sobre novedad {serial.serial}: {exc}")
