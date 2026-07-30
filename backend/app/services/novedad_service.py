from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import cav_ids_for_regional, regional_scoped_cav_ids
from app.core.config import settings
from app.core.enums import NovedadEstado, NovedadTipo, RoleName, SerialStatus
from app.core.errors import ApiError
from app.models.cav import CAV
from app.models.novedad_baja import NovedadBaja
from app.models.novedad_resolucion import NovedadResolucion
from app.models.novedad_soporte import NovedadSoporte
from app.models.reception import Reception
from app.models.role import Role
from app.models.serial import Serial
from app.models.serial_movement import SerialMovement
from app.models.user import User
from app.schemas.cav import CAVRead
from app.schemas.novedad import (
    AprobarNovedadRequest,
    NovedadBajaRead,
    NovedadCerradaRead,
    NovedadRead,
    NovedadResolucionRead,
    NovedadSoporteRead,
)
from app.schemas.serial import AbastecimientoCreate
from app.services.audit_service import register_audit_log
from app.services.email_service import EmailService
from app.services.serial_service import register_supply, resolve_material


def _ensure_novedad_in_scope(current_user: User, serial: Serial, db: Session) -> None:
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None and serial.cav_id not in regional_ids:
        raise ApiError("Esta novedad no pertenece a tus regionales.", 403)


def _resolver_cav_destino(
    db: Session, *, serial: Serial, cav_id: int | None, current_user: User
) -> CAV:
    """CAV con el que se ingresara la novedad; Trade puede corregir el origen al aprobar."""
    destino_id = cav_id or serial.cav_id
    if destino_id is None:
        raise ApiError("La novedad no tiene un CAV asignado.", 400)

    if destino_id == serial.cav_id and serial.cav is not None:
        return serial.cav

    cav = db.get(CAV, destino_id)
    if not cav:
        raise ApiError("CAV no encontrado.", 404)

    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None and cav.id not in regional_ids:
        raise ApiError("El CAV seleccionado no pertenece a tus regionales.", 403)
    return cav


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
    recepciones: dict[int, Reception] = {}
    if serial_ids:
        resoluciones = list(
            db.scalars(
                select(NovedadResolucion)
                .options(joinedload(NovedadResolucion.resuelto_por))
                .where(NovedadResolucion.serial_id.in_(serial_ids))
                .order_by(NovedadResolucion.id.desc())
            )
        )
        for resolucion in resoluciones:
            if resolucion.estado == NovedadEstado.PENDIENTE_OPS.value:
                pending.setdefault(resolucion.serial_id, resolucion)
            elif resolucion.estado == NovedadEstado.RECHAZADA.value:
                last_rejected.setdefault(resolucion.serial_id, resolucion)

        # Quien recibio el serial: es el contexto que Trade necesita para verificar
        # la novedad con el asesor antes de aprobarla o solucionarla.
        for recepcion in db.scalars(
            select(Reception)
            .options(joinedload(Reception.user))
            .where(Reception.serial_id.in_(serial_ids))
        ):
            recepciones.setdefault(recepcion.serial_id, recepcion)

    items: list[NovedadRead] = []
    for serial in serials:
        en_aprobacion = pending.get(serial.id)
        rechazada = last_rejected.get(serial.id)
        # Una novedad rechazada por OPS vuelve a ser accionable, pero se marca como
        # devuelta para que Trade la distinga de una recien generada.
        devuelta = rechazada if (rechazada and not en_aprobacion) else None
        if en_aprobacion:
            estado = "en_aprobacion"
        elif devuelta:
            estado = "devuelta"
        else:
            estado = "nueva"
        ultima = en_aprobacion or devuelta
        recepcion = recepciones.get(serial.id)
        items.append(
            NovedadRead(
                serial_id=serial.id,
                serial=serial.serial,
                descripcion_producto=serial.descripcion_producto,
                cav=CAVRead.model_validate(serial.cav) if serial.cav else None,
                creada_at=serial.created_at,
                last_movement_at=serial.last_movement_at,
                estado_resolucion=estado,
                resolucion_id=en_aprobacion.id if en_aprobacion else None,
                tipo_resolucion=ultima.tipo if ultima else None,
                observacion_ops=devuelta.observacion_ops if devuelta else None,
                devuelta_por=(
                    devuelta.resuelto_por.nombre_usuario
                    if devuelta and devuelta.resuelto_por
                    else None
                ),
                devuelta_at=devuelta.resuelto_at if devuelta else None,
                recibido_por=recepcion.user.nombre_usuario if recepcion and recepcion.user else None,
                fecha_recepcion=recepcion.fecha if recepcion else None,
            )
        )
    return items


MAX_SOPORTE_BYTES = 5 * 1024 * 1024
SOPORTE_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


def guardar_soporte(
    db: Session, *, nombre_archivo: str, content_type: str, contenido: bytes, current_user: User
) -> NovedadSoporte:
    """Guarda el archivo de soporte que Trade adjunta a una novedad."""
    if not contenido:
        raise ApiError("El archivo de soporte esta vacio.", 400)
    if len(contenido) > MAX_SOPORTE_BYTES:
        raise ApiError("El soporte no puede superar 5 MB.", 400)
    tipo = (content_type or "").split(";")[0].strip().lower()
    if tipo not in SOPORTE_CONTENT_TYPES:
        raise ApiError("Formato no permitido. Adjunta un PDF o una imagen (JPG, PNG o WEBP).", 400)

    soporte = NovedadSoporte(
        nombre_archivo=(nombre_archivo or "soporte")[:255],
        content_type=tipo,
        tamano_bytes=len(contenido),
        contenido=contenido,
        subido_por_id=current_user.id,
        subido_por_nombre=current_user.nombre_usuario,
    )
    db.add(soporte)
    db.commit()
    db.refresh(soporte)
    return soporte


def obtener_soporte(db: Session, soporte_id: int) -> NovedadSoporte:
    soporte = db.get(NovedadSoporte, soporte_id)
    if not soporte:
        raise ApiError("Soporte no encontrado.", 404)
    return soporte


def _serialize_soporte(soporte: NovedadSoporte | None) -> NovedadSoporteRead | None:
    return serialize_soporte(soporte) if soporte is not None else None


def serialize_soporte(soporte: NovedadSoporte) -> NovedadSoporteRead:
    return NovedadSoporteRead(
        id=soporte.id,
        nombre_archivo=soporte.nombre_archivo,
        content_type=soporte.content_type,
        tamano_bytes=soporte.tamano_bytes,
        subido_por_nombre=soporte.subido_por_nombre,
        created_at=soporte.created_at,
    )


def _validar_soporte_id(db: Session, soporte_id: int | None) -> int | None:
    if soporte_id is None:
        return None
    obtener_soporte(db, soporte_id)
    return soporte_id


def solicitar_baja(
    db: Session, *, serial_id: int, observacion: str, soporte_id: int, current_user: User
) -> NovedadResolucion:
    """Trade solicita solucionar la novedad dando de baja el serial.

    No elimina nada: crea una solicitud pendiente de OPS, igual que el ingreso a
    abastecimiento. La baja se ejecuta en `ops_aprobar`.
    """
    serial = _get_novedad(db, serial_id)
    _ensure_novedad_in_scope(current_user, serial, db)
    if not observacion or not observacion.strip():
        raise ApiError("La observacion es obligatoria.", 400)
    if serial.cav_id is None:
        raise ApiError("La novedad no tiene un CAV asignado.", 400)

    ya_pendiente = db.scalar(
        select(NovedadResolucion).where(
            NovedadResolucion.serial_id == serial_id,
            NovedadResolucion.estado == NovedadEstado.PENDIENTE_OPS.value,
        )
    )
    if ya_pendiente:
        raise ApiError("Esta novedad ya esta en aprobacion por OPS.", 409)

    resolucion = NovedadResolucion(
        serial_id=serial.id,
        cav_id=serial.cav_id,
        estado=NovedadEstado.PENDIENTE_OPS.value,
        tipo=NovedadTipo.BAJA.value,
        observacion_trade=observacion.strip(),
        soporte_id=_validar_soporte_id(db, soporte_id),
        creado_por_id=current_user.id,
    )
    db.add(resolucion)
    register_audit_log(
        db,
        action="novedad_solicitar_baja",
        entity="serial",
        entity_id=serial.id,
        user_id=current_user.id,
        payload={"serial": serial.serial, "observacion": observacion.strip()},
    )
    db.commit()
    db.refresh(resolucion)
    _notify_ops(db, resolucion=resolucion, serial=serial, creado_por=current_user)
    return resolucion


def _ejecutar_baja(
    db: Session, *, resolucion: NovedadResolucion, observacion_ops: str | None, current_user: User
) -> None:
    """Elimina el serial y su historial, dejando el registro en `novedad_bajas`.

    Solo se llama cuando OPS aprueba una solicitud de tipo 'baja'.
    """
    serial = resolucion.serial
    if serial is None:
        raise ApiError("El serial de la solicitud ya no existe.", 404)

    # Se capturan antes de borrar: despues del DELETE la resolucion queda expirada en la
    # sesion y leer sus atributos volveria a consultar una fila que ya no existe.
    serial_id = serial.id
    serial_code = serial.serial
    solicitante = resolucion.creado_por
    solicitante_id = resolucion.creado_por_id
    solicitante_nombre = solicitante.nombre_usuario if solicitante else "Trade"
    motivo = resolucion.observacion_trade

    db.add(
        NovedadBaja(
            serial=serial_code,
            descripcion_producto=serial.descripcion_producto,
            cav_id=serial.cav_id,
            cav_nombre=serial.cav.nombre_cav if serial.cav else None,
            motivo=motivo,
            usuario_id=solicitante_id,
            usuario_nombre=solicitante_nombre,
            aprobado_por_id=current_user.id,
            aprobado_por_nombre=current_user.nombre_usuario,
            observacion_ops=observacion_ops,
            # El soporte se conserva: la resolucion se borra con el serial.
            soporte_id=resolucion.soporte_id,
        )
    )
    db.execute(delete(NovedadResolucion).where(NovedadResolucion.serial_id == serial_id))
    db.execute(delete(SerialMovement).where(SerialMovement.serial_id == serial_id))
    db.execute(delete(Reception).where(Reception.serial_id == serial_id))
    register_audit_log(
        db,
        action="novedad_ops_aprobar_baja",
        entity="serial",
        entity_id=serial_id,
        user_id=current_user.id,
        payload={
            "serial": serial_code,
            "motivo": motivo,
            "solicitado_por": solicitante_nombre,
            "observacion_ops": observacion_ops,
        },
    )
    db.delete(serial)
    db.commit()


def list_bajas(
    db: Session, *, current_user: User, cav_id: int | None = None, regional: str | None = None
) -> list[NovedadBajaRead]:
    stmt = (
        select(NovedadBaja)
        .options(joinedload(NovedadBaja.soporte))
        .order_by(NovedadBaja.created_at.desc(), NovedadBaja.id.desc())
    )
    if cav_id:
        stmt = stmt.where(NovedadBaja.cav_id == cav_id)
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None:
        stmt = stmt.where(NovedadBaja.cav_id.in_(regional_ids))
    regional_filter_ids = cav_ids_for_regional(db, regional)
    if regional_filter_ids is not None:
        stmt = stmt.where(NovedadBaja.cav_id.in_(regional_filter_ids))
    bajas = list(db.scalars(stmt))
    return [
        NovedadBajaRead(
            id=baja.id,
            serial=baja.serial,
            descripcion_producto=baja.descripcion_producto,
            cav_nombre=baja.cav_nombre,
            motivo=baja.motivo,
            usuario_nombre=baja.usuario_nombre,
            aprobado_por_nombre=baja.aprobado_por_nombre,
            observacion_ops=baja.observacion_ops,
            soporte=_serialize_soporte(baja.soporte),
            created_at=baja.created_at,
        )
        for baja in bajas
    ]


def list_cerradas(
    db: Session, *, current_user: User, cav_id: int | None = None, regional: str | None = None
) -> list[NovedadCerradaRead]:
    """Novedades ya cerradas por cualquiera de las dos ramas del flujo.

    - `ingreso`: OPS aprobo y el serial entro a abastecimiento del CAV.
    - `baja`: OPS aprobo la solucion y el serial se dio de baja.
    """
    regional_ids = regional_scoped_cav_ids(current_user, db)
    regional_filter_ids = cav_ids_for_regional(db, regional)

    ingresos_stmt = (
        select(NovedadResolucion)
        .options(
            joinedload(NovedadResolucion.serial),
            joinedload(NovedadResolucion.cav),
            joinedload(NovedadResolucion.creado_por),
            joinedload(NovedadResolucion.resuelto_por),
            joinedload(NovedadResolucion.soporte),
        )
        .where(NovedadResolucion.estado == NovedadEstado.APROBADA.value)
    )
    bajas_stmt = select(NovedadBaja).options(joinedload(NovedadBaja.soporte))

    if cav_id:
        ingresos_stmt = ingresos_stmt.where(NovedadResolucion.cav_id == cav_id)
        bajas_stmt = bajas_stmt.where(NovedadBaja.cav_id == cav_id)
    if regional_ids is not None:
        ingresos_stmt = ingresos_stmt.where(NovedadResolucion.cav_id.in_(regional_ids))
        bajas_stmt = bajas_stmt.where(NovedadBaja.cav_id.in_(regional_ids))
    if regional_filter_ids is not None:
        ingresos_stmt = ingresos_stmt.where(NovedadResolucion.cav_id.in_(regional_filter_ids))
        bajas_stmt = bajas_stmt.where(NovedadBaja.cav_id.in_(regional_filter_ids))

    items: list[NovedadCerradaRead] = []
    for resolucion in db.scalars(ingresos_stmt):
        items.append(
            NovedadCerradaRead(
                key=f"ingreso-{resolucion.id}",
                serial=resolucion.serial.serial if resolucion.serial else "",
                cav_nombre=resolucion.cav.nombre_cav if resolucion.cav else None,
                resultado=NovedadTipo.INGRESO.value,
                observacion_trade=resolucion.observacion_trade,
                observacion_ops=resolucion.observacion_ops,
                solicitado_por=resolucion.creado_por.nombre_usuario if resolucion.creado_por else None,
                aprobado_por=resolucion.resuelto_por.nombre_usuario if resolucion.resuelto_por else None,
                soporte=_serialize_soporte(resolucion.soporte),
                cerrada_at=resolucion.resuelto_at,
            )
        )
    for baja in db.scalars(bajas_stmt):
        items.append(
            NovedadCerradaRead(
                key=f"baja-{baja.id}",
                serial=baja.serial,
                cav_nombre=baja.cav_nombre,
                resultado=NovedadTipo.BAJA.value,
                observacion_trade=baja.motivo,
                observacion_ops=baja.observacion_ops,
                solicitado_por=baja.usuario_nombre,
                aprobado_por=baja.aprobado_por_nombre,
                soporte=_serialize_soporte(baja.soporte),
                cerrada_at=baja.created_at,
            )
        )

    # Las mas recientes primero; las que no tengan fecha quedan al final.
    sin_fecha = datetime.min.replace(tzinfo=UTC)
    items.sort(key=lambda item: item.cerrada_at or sin_fecha, reverse=True)
    return items


def aprobar_novedad(
    db: Session, *, serial_id: int, payload: AprobarNovedadRequest, current_user: User
) -> NovedadResolucion:
    serial = _get_novedad(db, serial_id)
    _ensure_novedad_in_scope(current_user, serial, db)

    descripcion_producto = payload.descripcion_producto.strip()
    if resolve_material(descripcion_producto) is None:
        raise ApiError(
            "El producto no es valido. Selecciona uno del catalogo disponible.",
            400,
        )

    # Trade puede corregir el CAV de origen de la novedad al aprobarla.
    cav = _resolver_cav_destino(db, serial=serial, cav_id=payload.cav_id, current_user=current_user)

    ya_pendiente = db.scalar(
        select(NovedadResolucion).where(
            NovedadResolucion.serial_id == serial_id,
            NovedadResolucion.estado == NovedadEstado.PENDIENTE_OPS.value,
        )
    )
    if ya_pendiente:
        raise ApiError("Esta novedad ya esta en aprobacion por OPS.", 409)

    centro_costos = (payload.centro_costos_cav or cav.centro_costos or "").strip()
    if not centro_costos:
        raise ApiError("Falta el centro de costos del CAV.", 400)

    resolucion = NovedadResolucion(
        serial_id=serial.id,
        cav_id=cav.id,
        estado=NovedadEstado.PENDIENTE_OPS.value,
        tipo=NovedadTipo.INGRESO.value,
        observacion_trade=payload.observacion.strip(),
        descripcion_producto=descripcion_producto,
        numero_guia=payload.numero_guia.strip(),
        centro_costos_cav=centro_costos,
        # La fecha de envio del abastecimiento es la de creacion de la novedad.
        fecha_envio=serial.created_at,
        fecha_entrega_pdv=payload.fecha_entrega_pdv,
        estado_entrega=payload.estado_entrega,
        soporte_id=_validar_soporte_id(db, payload.soporte_id),
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
                joinedload(NovedadResolucion.soporte),
            )
            .where(NovedadResolucion.estado == NovedadEstado.PENDIENTE_OPS.value)
            .order_by(NovedadResolucion.created_at.asc())
        )
    )
    return [_serialize_resolucion(resolucion) for resolucion in resoluciones]


def ops_aprobar(
    db: Session, *, resolucion_id: int, observacion: str | None, current_user: User
) -> NovedadResolucion | None:
    """OPS da el visto bueno final: ingresa el serial a abastecimiento o ejecuta la baja.

    Devuelve None cuando la solicitud era de baja, porque en ese caso la resolucion se
    elimina junto con el serial (la trazabilidad queda en `novedad_bajas`).
    """
    resolucion = db.scalar(
        select(NovedadResolucion)
        .options(
            joinedload(NovedadResolucion.serial),
            joinedload(NovedadResolucion.creado_por),
        )
        .where(NovedadResolucion.id == resolucion_id)
    )
    if not resolucion or resolucion.estado != NovedadEstado.PENDIENTE_OPS.value:
        raise ApiError("Solicitud no encontrada o ya resuelta.", 404)

    if resolucion.tipo == NovedadTipo.BAJA.value:
        _ejecutar_baja(
            db,
            resolucion=resolucion,
            observacion_ops=(observacion or "").strip() or None,
            current_user=current_user,
        )
        return None

    if not resolucion.descripcion_producto or not resolucion.numero_guia or not resolucion.fecha_envio:
        raise ApiError("La solicitud no tiene los datos de abastecimiento completos.", 400)

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
        select(NovedadResolucion)
        .options(
            joinedload(NovedadResolucion.serial),
            joinedload(NovedadResolucion.cav),
            joinedload(NovedadResolucion.creado_por),
        )
        .where(NovedadResolucion.id == resolucion_id)
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
    _notify_trade_devuelta(db, resolucion=resolucion, resuelto_por=current_user)
    return resolucion


def _notify_trade_devuelta(
    db: Session, *, resolucion: NovedadResolucion, resuelto_por: User
) -> None:
    """Avisa por correo a quien creo la solicitud que OPS la devolvio."""
    try:
        solicitante = resolucion.creado_por or db.get(User, resolucion.creado_por_id)
        if not solicitante or not solicitante.correo:
            return
        tipo_label = (
            "Solucion (baja del serial)"
            if resolucion.tipo == NovedadTipo.BAJA.value
            else "Ingreso a abastecimiento"
        )
        EmailService.send_novedad_devuelta_trade(
            recipient_email=solicitante.correo,
            serial=resolucion.serial.serial if resolucion.serial else "",
            cav_nombre=resolucion.cav.nombre_cav if resolucion.cav else "Sin CAV",
            tipo_label=tipo_label,
            motivo_ops=resolucion.observacion_ops or "",
            resuelto_por=resuelto_por.nombre_usuario,
            app_link=f"{settings.frontend_url.rstrip('/')}/novedades",
        )
    except Exception as exc:  # noqa: BLE001 - el correo no debe romper el flujo
        print(f"Error notificando a Trade la devolucion de la novedad: {exc}")


def serialize_resolucion(db: Session, resolucion: NovedadResolucion) -> NovedadResolucionRead:
    full = db.scalar(
        select(NovedadResolucion)
        .options(
            joinedload(NovedadResolucion.serial),
            joinedload(NovedadResolucion.cav),
            joinedload(NovedadResolucion.creado_por),
            joinedload(NovedadResolucion.soporte),
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
        tipo=resolucion.tipo,
        observacion_trade=resolucion.observacion_trade,
        observacion_ops=resolucion.observacion_ops,
        descripcion_producto=resolucion.descripcion_producto,
        numero_guia=resolucion.numero_guia,
        centro_costos_cav=resolucion.centro_costos_cav,
        fecha_envio=resolucion.fecha_envio,
        fecha_entrega_pdv=resolucion.fecha_entrega_pdv,
        estado_entrega=resolucion.estado_entrega,
        creado_por=resolucion.creado_por.nombre_usuario if resolucion.creado_por else None,
        soporte=_serialize_soporte(resolucion.soporte),
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
        if resolucion.tipo == NovedadTipo.BAJA.value:
            descripcion = (
                f"Solicitud de baja del serial. Motivo: {resolucion.observacion_trade}"
            )
        else:
            descripcion = resolucion.descripcion_producto or serial.descripcion_producto or "Sin descripcion"
        for correo in ops_emails:
            EmailService.send_novedad_pendiente_ops(
                recipient_email=correo,
                serial=serial.serial,
                cav_nombre=serial.cav.nombre_cav if serial.cav else "Sin CAV",
                descripcion=descripcion,
                creado_por=creado_por.nombre_usuario,
                app_link=app_link,
            )
    except Exception as exc:  # noqa: BLE001 - el correo no debe romper el flujo
        print(f"Error notificando a OPS sobre novedad {serial.serial}: {exc}")
