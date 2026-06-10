from datetime import date, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import ensure_cav_scope, has_global_cav_access
from app.core.enums import MovementType, RoleName, SerialStatus
from app.core.errors import ApiError
from app.models.abastecimiento import Abastecimiento
from app.models.cav import CAV
from app.models.legalization import Legalization
from app.models.reception import Reception
from app.models.serial import Serial
from app.models.serial_movement import SerialMovement
from app.models.user import User
from app.schemas.serial import (
    AbastecimientoCreate,
    AbastecimientoUpdate,
    LegalizationCreate,
    LegalizationRead,
    MarkDuplicateRequest,
    ReceptionBatchCreate,
    ReceptionRead,
    SupplyDeleteManyRequest,
    SupplyRead,
)
from app.services.audit_service import register_audit_log


PRODUCTO_MATERIAL_MAP: dict[str, str] = {
    "mate": "7018735",
    "privacy": "7018734",
    "blue light": "7015640",
    "estandar": "7015490",
}


def resolve_material(descripcion_producto: str | None) -> str | None:
    if not descripcion_producto:
        return None
    return PRODUCTO_MATERIAL_MAP.get(descripcion_producto.strip().lower())


ESTADO_ENTREGA_PENDIENTE = "Pendiente de Entrega"
ESTADO_ENTREGA_ENTREGADO = "Entregado por Transportadora"
ESTADO_ENTREGA_VALIDOS = {ESTADO_ENTREGA_PENDIENTE, ESTADO_ENTREGA_ENTREGADO}


def resolve_estado_entrega(value: str | None) -> str:
    if not value:
        return ESTADO_ENTREGA_PENDIENTE
    cleaned = value.strip()
    for option in ESTADO_ENTREGA_VALIDOS:
        if cleaned.lower() == option.lower():
            return option
    raise ApiError(
        f"Estado de entrega invalido. Opciones permitidas: {', '.join(sorted(ESTADO_ENTREGA_VALIDOS))}.",
        400,
    )


def _serial_detail_stmt() -> Select[tuple[Serial]]:
    return select(Serial).options(joinedload(Serial.cav))


def _supply_detail_stmt() -> Select[tuple[Abastecimiento]]:
    return select(Abastecimiento).options(
        joinedload(Abastecimiento.serial).joinedload(Serial.cav),
        joinedload(Abastecimiento.cav),
    )


def _reception_detail_stmt() -> Select[tuple[Reception]]:
    return select(Reception).options(
        joinedload(Reception.serial),
        joinedload(Reception.cav),
        joinedload(Reception.user),
    )


def _legalization_detail_stmt() -> Select[tuple[Legalization]]:
    return select(Legalization).options(
        joinedload(Legalization.serial).joinedload(Serial.cav),
        joinedload(Legalization.user),
    )


def get_serial_by_code(db: Session, serial_code: str) -> Serial | None:
    return db.scalar(_serial_detail_stmt().where(Serial.serial == serial_code))


def get_supply_by_id(db: Session, supply_id: int) -> Abastecimiento | None:
    return db.scalar(_supply_detail_stmt().where(Abastecimiento.id == supply_id))


def _format_serial_list(seriales: list[str], limit: int = 8) -> str:
    preview = ", ".join(seriales[:limit])
    if len(seriales) > limit:
        preview += f" y {len(seriales) - limit} mas"
    return preview


def _receipt_for_serial_exists(db: Session, serial_id: int) -> bool:
    return db.scalar(select(Reception.id).where(Reception.serial_id == serial_id).limit(1)) is not None


def _flush_receipt_write(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        raise ApiError(
            "No se guardo el recibo porque uno de los seriales ya fue registrado en otro recibo.",
            409,
        ) from error


def _normalize_receipt_serials(seriales: list[str]) -> tuple[list[str], list[str]]:
    seen: set[str] = set()
    normalized: list[str] = []
    duplicated_in_batch: list[str] = []

    for code in seriales:
        serial_code = code.strip()
        if not serial_code:
            continue
        if serial_code in seen:
            duplicated_in_batch.append(serial_code)
            continue
        seen.add(serial_code)
        normalized.append(serial_code)

    return normalized, duplicated_in_batch


def list_receipts(
    db: Session,
    *,
    current_user: User,
) -> list[Reception]:
    stmt = _reception_detail_stmt().order_by(Reception.fecha.desc(), Reception.id.desc())

    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            return []
        if current_user.role.name == RoleName.ASESOR.value:
            stmt = stmt.where(Reception.usuario_id == current_user.id)
        stmt = stmt.where(Reception.cav_id == current_user.cav_id)

    return list(db.scalars(stmt))


def list_legalizations(
    db: Session,
    *,
    current_user: User,
    cav_id: int | None = None,
    end_date: date | None = None,
    start_date: date | None = None,
    user_id: int | None = None,
) -> list[Legalization]:
    stmt = _legalization_detail_stmt().join(Legalization.serial).order_by(Legalization.fecha.desc(), Legalization.id.desc())

    if cav_id:
        stmt = stmt.where(Serial.cav_id == cav_id)
    if user_id:
        stmt = stmt.where(Legalization.usuario_id == user_id)
    if start_date:
        stmt = stmt.where(func.date(Legalization.fecha) >= start_date)
    if end_date:
        stmt = stmt.where(func.date(Legalization.fecha) <= end_date)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            return []
        stmt = stmt.where(Serial.cav_id == current_user.cav_id)

    return list(db.scalars(stmt))


def serialize_supply(supply: Abastecimiento) -> SupplyRead:
    return SupplyRead(
        id=supply.id,
        serial_id=supply.serial_id,
        serial=supply.serial.serial,
        descripcion_producto=supply.descripcion_producto,
        material=supply.material,
        numero_guia=supply.numero_guia,
        cav_id=supply.cav_id,
        centro_costos_cav=supply.centro_costos_cav,
        fecha_envio=supply.fecha_envio,
        fecha_entrega_pdv=supply.fecha_entrega_pdv,
        estado_entrega=supply.estado_entrega or ESTADO_ENTREGA_PENDIENTE,
        current_status=supply.serial.current_status,
        cav=supply.serial.cav,
    )


def serialize_reception(reception: Reception) -> ReceptionRead:
    return ReceptionRead(
        id=reception.id,
        serial_id=reception.serial_id,
        serial=reception.serial.serial,
        cav_id=reception.cav_id,
        fecha=reception.fecha,
        confirmado_por=reception.user.nombre_usuario,
        cav=reception.cav,
    )


def serialize_legalization(legalization: Legalization) -> LegalizationRead:
    return LegalizationRead(
        id=legalization.id,
        serial_id=legalization.serial_id,
        serial=legalization.serial.serial,
        fecha=legalization.fecha,
        tipo_inventario=legalization.tipo_inventario,
        tipo_uso=legalization.tipo_uso,
        cliente_asesor=legalization.cliente_asesor,
        documento_cliente=legalization.documento_cliente,
        numero_factura=legalization.numero_factura,
        firma=legalization.firma,
        asesor_responsable=legalization.asesor_responsable,
        registrado_por=legalization.user.nombre_usuario,
        cav=legalization.serial.cav,
    )


def create_movement(
    db: Session,
    *,
    serial_obj: Serial,
    movement_type: MovementType,
    previous_status: SerialStatus | None,
    new_status: SerialStatus,
    source_table: str,
    source_id: int | None,
    cav_id: int | None,
    user_id: int | None,
    notes: str | None = None,
) -> None:
    serial_obj.current_status = new_status
    serial_obj.last_movement_at = datetime.utcnow()
    movement = SerialMovement(
        serial=serial_obj,
        movement_type=movement_type,
        previous_status=previous_status,
        new_status=new_status,
        source_table=source_table,
        source_id=source_id,
        cav_id=cav_id,
        user_id=user_id,
        notes=notes,
    )
    db.add(movement)


def _reconcile_pending_supply(
    db: Session,
    *,
    serial_obj: Serial,
    payload: AbastecimientoCreate,
    centro_costos_cav: str,
    current_user: User,
) -> Abastecimiento:
    """Completa el abastecimiento de un serial recibido como PENDIENTE.

    El serial ya fue recibido fisicamente (tiene su recepcion registrada) pero
    nunca paso por abastecimiento, por lo que quedo en estado PENDIENTE. Aqui
    registramos el abastecimiento faltante y lo disponibilizamos para legalizar,
    sin alterar el flujo normal de creacion de seriales nuevos.
    """
    ensure_cav_scope(current_user, serial_obj.cav_id)

    serial_obj.descripcion_producto = payload.descripcion_producto
    serial_obj.cav_id = payload.cav_id
    serial_obj.last_movement_at = payload.fecha_envio

    supply = Abastecimiento(
        serial_id=serial_obj.id,
        descripcion_producto=payload.descripcion_producto,
        material=resolve_material(payload.descripcion_producto),
        numero_guia=payload.numero_guia.strip(),
        cav_id=payload.cav_id,
        centro_costos_cav=centro_costos_cav,
        fecha_envio=payload.fecha_envio,
        fecha_entrega_pdv=payload.fecha_entrega_pdv,
        estado_entrega=resolve_estado_entrega(payload.estado_entrega),
        usuario_id=current_user.id,
    )
    db.add(supply)
    db.flush()

    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.ABASTECIMIENTO,
        previous_status=SerialStatus.PENDIENTE,
        new_status=SerialStatus.ENVIADO,
        source_table="abastecimientos",
        source_id=supply.id,
        cav_id=payload.cav_id,
        user_id=current_user.id,
        notes="Abastecimiento conciliado para serial recibido como pendiente.",
    )
    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.DISPONIBILIDAD,
        previous_status=SerialStatus.ENVIADO,
        new_status=SerialStatus.DISPONIBLE,
        source_table="abastecimientos",
        source_id=supply.id,
        cav_id=payload.cav_id,
        user_id=current_user.id,
        notes="Serial disponible para legalizar (ya habia sido recibido).",
    )
    register_audit_log(
        db,
        action="reconcile_pending_supply",
        entity="serial",
        entity_id=serial_obj.id,
        user_id=current_user.id,
        payload={
            "serial": serial_obj.serial,
            "numero_guia": payload.numero_guia.strip(),
            "cav_id": payload.cav_id,
            "centro_costos_cav": centro_costos_cav,
            "fecha_envio": payload.fecha_envio.isoformat(),
        },
    )
    db.commit()
    return get_supply_by_id(db, supply.id) or supply


def register_supply(
    db: Session,
    payload: AbastecimientoCreate,
    current_user: User,
) -> Abastecimiento:
    ensure_cav_scope(current_user, payload.cav_id)

    cav_obj = db.get(CAV, payload.cav_id)
    if not cav_obj:
        raise ApiError("CAV no encontrado.", 404)

    centro_costos_cav = payload.centro_costos_cav.strip() or cav_obj.centro_costos

    existing = get_serial_by_code(db, payload.serial)
    if existing:
        # Mejora: un serial que fue recibido sin abastecimiento previo queda en
        # estado PENDIENTE. En ese caso completamos el abastecimiento faltante y
        # lo dejamos DISPONIBLE para legalizar, en lugar de rechazarlo. Cualquier
        # otro estado se sigue bloqueando igual que antes.
        if existing.current_status == SerialStatus.PENDIENTE:
            return _reconcile_pending_supply(
                db,
                serial_obj=existing,
                payload=payload,
                centro_costos_cav=centro_costos_cav,
                current_user=current_user,
            )
        raise ApiError(f"El serial {payload.serial} ya existe en inventario.", 409)

    serial_obj = Serial(
        serial=payload.serial,
        descripcion_producto=payload.descripcion_producto,
        cav_id=payload.cav_id,
        current_status=SerialStatus.ENVIADO,
        created_by_id=current_user.id,
        last_movement_at=payload.fecha_envio,
    )
    db.add(serial_obj)
    db.flush()

    supply = Abastecimiento(
        serial_id=serial_obj.id,
        descripcion_producto=payload.descripcion_producto,
        material=resolve_material(payload.descripcion_producto),
        numero_guia=payload.numero_guia.strip(),
        cav_id=payload.cav_id,
        centro_costos_cav=centro_costos_cav,
        fecha_envio=payload.fecha_envio,
        fecha_entrega_pdv=payload.fecha_entrega_pdv,
        estado_entrega=resolve_estado_entrega(payload.estado_entrega),
        usuario_id=current_user.id,
    )
    db.add(supply)
    db.flush()

    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.ABASTECIMIENTO,
        previous_status=None,
        new_status=SerialStatus.ENVIADO,
        source_table="abastecimientos",
        source_id=supply.id,
        cav_id=payload.cav_id,
        user_id=current_user.id,
        notes="Serial abastecido al CAV.",
    )
    register_audit_log(
        db,
        action="create_supply",
        entity="serial",
        entity_id=serial_obj.id,
        user_id=current_user.id,
        payload={
            "serial": payload.serial,
            "numero_guia": payload.numero_guia.strip(),
            "cav_id": payload.cav_id,
            "centro_costos_cav": centro_costos_cav,
            "fecha_envio": payload.fecha_envio.isoformat(),
        },
    )
    db.commit()
    return get_supply_by_id(db, supply.id) or supply


def list_supplies(
    db: Session,
    *,
    current_user: User,
    cav_id: int | None = None,
    end_date: date | None = None,
    producto: str | None = None,
    serial: str | None = None,
    start_date: date | None = None,
    status: SerialStatus | None = None,
    user_id: int | None = None,
) -> list[Abastecimiento]:
    stmt = _supply_detail_stmt().join(Abastecimiento.serial).order_by(Abastecimiento.fecha_envio.desc())

    if status:
        stmt = stmt.where(Serial.current_status == status)
    if cav_id:
        stmt = stmt.where(Abastecimiento.cav_id == cav_id)
    if serial:
        stmt = stmt.where(Serial.serial.ilike(f"%{serial}%"))
    if producto:
        stmt = stmt.where(Abastecimiento.descripcion_producto.ilike(f"%{producto}%"))
    if start_date:
        stmt = stmt.where(func.date(Abastecimiento.fecha_envio) >= start_date)
    if end_date:
        stmt = stmt.where(func.date(Abastecimiento.fecha_envio) <= end_date)
    if user_id:
        stmt = stmt.where(Abastecimiento.usuario_id == user_id)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            return []
        stmt = stmt.where(Abastecimiento.cav_id == current_user.cav_id)

    return list(db.scalars(stmt))


def update_supply(
    db: Session,
    *,
    supply_id: int,
    payload: AbastecimientoUpdate,
    current_user: User,
) -> Abastecimiento:
    supply = get_supply_by_id(db, supply_id)
    if not supply:
        raise ApiError("Abastecimiento no encontrado.", 404)

    ensure_cav_scope(current_user, supply.cav_id)
    ensure_cav_scope(current_user, payload.cav_id)

    cav_obj = db.get(CAV, payload.cav_id)
    if not cav_obj:
        raise ApiError("CAV no encontrado.", 404)

    serial_obj = supply.serial
    duplicate_serial = get_serial_by_code(db, payload.serial)
    if duplicate_serial and duplicate_serial.id != serial_obj.id:
        raise ApiError(f"El serial {payload.serial} ya existe en inventario.", 409)

    centro_costos_cav = payload.centro_costos_cav.strip() or cav_obj.centro_costos

    serial_obj.serial = payload.serial
    serial_obj.descripcion_producto = payload.descripcion_producto
    serial_obj.last_movement_at = payload.fecha_envio

    # Solo actualizar el CAV del serial si aun esta en transito.
    if serial_obj.current_status == SerialStatus.ENVIADO and payload.cav_id != serial_obj.cav_id:
        serial_obj.cav_id = payload.cav_id

    supply.descripcion_producto = payload.descripcion_producto
    supply.material = resolve_material(payload.descripcion_producto)
    supply.numero_guia = payload.numero_guia.strip()
    supply.cav_id = payload.cav_id
    supply.centro_costos_cav = centro_costos_cav
    supply.fecha_envio = payload.fecha_envio
    supply.fecha_entrega_pdv = payload.fecha_entrega_pdv
    supply.estado_entrega = resolve_estado_entrega(payload.estado_entrega)

    movement = db.scalar(
        select(SerialMovement)
        .where(
            SerialMovement.source_table == "abastecimientos",
            SerialMovement.source_id == supply.id,
        )
        .order_by(SerialMovement.created_at.desc())
    )
    if movement:
        movement.cav_id = payload.cav_id
        movement.user_id = current_user.id
        movement.notes = "Registro de abastecimiento actualizado."

    register_audit_log(
        db,
        action="update_supply",
        entity="abastecimientos",
        entity_id=supply.id,
        user_id=current_user.id,
        payload={
            "serial": payload.serial,
            "numero_guia": payload.numero_guia.strip(),
            "cav_id": payload.cav_id,
            "centro_costos_cav": centro_costos_cav,
            "fecha_envio": payload.fecha_envio.isoformat(),
        },
    )
    db.commit()
    return get_supply_by_id(db, supply.id) or supply


def _validate_supply_can_be_deleted(supply: Abastecimiento, current_user: User) -> None:
    ensure_cav_scope(current_user, supply.cav_id)
    if supply.serial.current_status != SerialStatus.ENVIADO:
        raise ApiError("Solo se pueden eliminar abastecimientos que sigan en estado en transito.", 409)


def delete_supply(
    db: Session,
    *,
    supply_id: int,
    current_user: User,
) -> None:
    supply = get_supply_by_id(db, supply_id)
    if not supply:
        raise ApiError("Abastecimiento no encontrado.", 404)

    _validate_supply_can_be_deleted(supply, current_user)

    serial_obj = supply.serial
    register_audit_log(
        db,
        action="delete_supply",
        entity="abastecimientos",
        entity_id=supply.id,
        user_id=current_user.id,
        payload={"serial": serial_obj.serial, "cav_id": supply.cav_id},
    )
    db.delete(serial_obj)
    db.commit()


def delete_supplies(
    db: Session,
    *,
    payload: SupplyDeleteManyRequest,
    current_user: User,
) -> int:
    deleted = 0

    for supply_id in payload.supply_ids:
        supply = get_supply_by_id(db, supply_id)
        if not supply:
            raise ApiError(f"Abastecimiento {supply_id} no encontrado.", 404)
        _validate_supply_can_be_deleted(supply, current_user)

    for supply_id in payload.supply_ids:
        supply = get_supply_by_id(db, supply_id)
        if not supply:
            continue
        register_audit_log(
            db,
            action="delete_supply",
            entity="abastecimientos",
            entity_id=supply.id,
            user_id=current_user.id,
            payload={"serial": supply.serial.serial, "cav_id": supply.cav_id},
        )
        db.delete(supply.serial)
        deleted += 1

    db.commit()
    return deleted


def register_receipts(
    db: Session,
    payload: ReceptionBatchCreate,
    current_user: User,
) -> tuple[list[Serial], list[Serial], list[str], list[dict]]:
    ensure_cav_scope(current_user, payload.cav_id)

    seriales, duplicated_in_batch = _normalize_receipt_serials(payload.seriales)
    if not seriales:
        raise ApiError("Debes escanear o ingresar al menos un serial valido.", 400)
    if duplicated_in_batch:
        raise ApiError(
            f"No se guardo el recibo. El lote trae seriales repetidos: {_format_serial_list(duplicated_in_batch)}.",
            409,
        )

    duplicates: list[str] = []
    processed: list[Serial] = []
    pending: list[Serial] = []
    blocked: list[dict] = []

    for serial_code in seriales:
        serial_obj = get_serial_by_code(db, serial_code)
        if not serial_obj:
            continue

        if _receipt_for_serial_exists(db, serial_obj.id) or serial_obj.current_status != SerialStatus.ENVIADO:
            duplicates.append(serial_code)
            continue

        if serial_obj.cav_id != payload.cav_id:
            blocked.append(
                {
                    "serial": serial_code,
                    "cav_asignado_id": serial_obj.cav_id,
                    "cav_asignado_nombre": serial_obj.cav.nombre_cav if serial_obj.cav else "Desconocido",
                }
            )
            continue

        ensure_cav_scope(current_user, serial_obj.cav_id)

    if duplicates or blocked:
        message_parts = ["No se guardo el recibo."]
        if duplicates:
            message_parts.append(
                f"Seriales ya registrados en un recibo o no disponibles para recibir: {_format_serial_list(duplicates)}."
            )
        if blocked:
            blocked_labels = [
                f"{item['serial']} pertenece a {item['cav_asignado_nombre']}"
                for item in blocked
            ]
            message_parts.append(
                "Seriales abastecidos a otro CAV: "
                f"{_format_serial_list(blocked_labels)}. "
                "Para recibirlos, primero cambia el CAV en Abastecimiento y guarda el cambio."
            )
        raise ApiError(" ".join(message_parts), 409)

    for serial_code in seriales:
        serial_obj = get_serial_by_code(db, serial_code)

        if not serial_obj:
            serial_obj = Serial(
                serial=serial_code,
                descripcion_producto="Pendiente de conciliacion",
                cav_id=payload.cav_id,
                current_status=SerialStatus.PENDIENTE,
                created_by_id=current_user.id,
                last_movement_at=payload.fecha,
            )
            db.add(serial_obj)
            _flush_receipt_write(db)

            reception = Reception(
                serial_id=serial_obj.id,
                cav_id=payload.cav_id,
                fecha=payload.fecha,
                usuario_id=current_user.id,
            )
            db.add(reception)
            _flush_receipt_write(db)

            create_movement(
                db,
                serial_obj=serial_obj,
                movement_type=MovementType.RECEPCION,
                previous_status=None,
                new_status=SerialStatus.PENDIENTE,
                source_table="recepciones",
                source_id=reception.id,
                cav_id=payload.cav_id,
                user_id=current_user.id,
                notes="Serial recibido sin abastecimiento previo.",
            )
            pending.append(serial_obj)
            continue

        serial_obj.cav_id = payload.cav_id
        reception = Reception(
            serial_id=serial_obj.id,
            cav_id=payload.cav_id,
            fecha=payload.fecha,
            usuario_id=current_user.id,
        )
        db.add(reception)
        _flush_receipt_write(db)

        previous_status = serial_obj.current_status
        create_movement(
            db,
            serial_obj=serial_obj,
            movement_type=MovementType.RECEPCION,
            previous_status=previous_status,
            new_status=SerialStatus.RECIBIDO,
            source_table="recepciones",
            source_id=reception.id,
            cav_id=payload.cav_id,
            user_id=current_user.id,
            notes="Serial validado en recibo.",
        )
        create_movement(
            db,
            serial_obj=serial_obj,
            movement_type=MovementType.DISPONIBILIDAD,
            previous_status=SerialStatus.RECIBIDO,
            new_status=SerialStatus.DISPONIBLE,
            source_table="recepciones",
            source_id=reception.id,
            cav_id=payload.cav_id,
            user_id=current_user.id,
            notes="Serial disponible para gestion.",
        )
        processed.append(serial_obj)

    register_audit_log(
        db,
        action="create_receipt_batch",
        entity="recepciones",
        entity_id=None,
        user_id=current_user.id,
        payload={
            "cav_id": payload.cav_id,
            "cantidad": len(payload.seriales),
            "duplicados": duplicates,
            "bloqueados": len(blocked),
        },
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ApiError(
            "No se guardo el recibo porque uno de los seriales ya fue registrado en otro recibo.",
            409,
        ) from error
    for item in [*processed, *pending]:
        db.refresh(item)
    return processed, pending, duplicates, blocked


def register_legalization(
    db: Session,
    payload: LegalizationCreate,
    current_user: User,
) -> Serial:
    serial_obj = get_serial_by_code(db, payload.serial)
    if not serial_obj:
        raise ApiError("Serial no encontrado.", 404)

    ensure_cav_scope(current_user, serial_obj.cav_id)
    if serial_obj.current_status != SerialStatus.DISPONIBLE:
        raise ApiError(
            f"El serial {payload.serial} no esta disponible para legalizar. Estado actual: {serial_obj.current_status.value}.",
            409,
        )

    legalization = Legalization(
        serial_id=serial_obj.id,
        tipo_inventario=payload.tipo_inventario,
        tipo_uso=payload.tipo_uso,
        material="No aplica",
        cantidad=1,
        cliente_asesor=payload.cliente_asesor,
        documento_cliente=payload.documento_cliente,
        numero_factura=payload.numero_factura.strip(),
        firma=payload.firma,
        asesor_responsable=payload.asesor_responsable,
        fecha=payload.fecha,
        usuario_id=current_user.id,
    )
    db.add(legalization)
    db.flush()

    previous_status = serial_obj.current_status
    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.LEGALIZACION,
        previous_status=previous_status,
        new_status=SerialStatus.GASTADO,
        source_table="legalizaciones",
        source_id=legalization.id,
        cav_id=serial_obj.cav_id,
        user_id=current_user.id,
        notes="Serial aplicado a gasto.",
    )
    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.LEGALIZACION,
        previous_status=SerialStatus.GASTADO,
        new_status=SerialStatus.LEGALIZADO,
        source_table="legalizaciones",
        source_id=legalization.id,
        cav_id=serial_obj.cav_id,
        user_id=current_user.id,
        notes=payload.tipo_inventario,
    )
    register_audit_log(
        db,
        action="create_legalization",
        entity="legalizaciones",
        entity_id=legalization.id,
        user_id=current_user.id,
        payload={
            "serial": payload.serial,
            "tipo_inventario": payload.tipo_inventario,
            "tipo_uso": payload.tipo_uso,
            "cliente_asesor": payload.cliente_asesor,
            "documento_cliente": payload.documento_cliente,
            "numero_factura": payload.numero_factura.strip(),
            "asesor_responsable": payload.asesor_responsable,
        },
    )
    db.commit()
    db.refresh(serial_obj)
    return serial_obj


def mark_duplicate(
    db: Session,
    payload: MarkDuplicateRequest,
    current_user: User,
) -> Serial:
    serial_obj = get_serial_by_code(db, payload.serial)
    if not serial_obj:
        raise ApiError("Serial no encontrado.", 404)

    ensure_cav_scope(current_user, serial_obj.cav_id)
    previous_status = serial_obj.current_status
    create_movement(
        db,
        serial_obj=serial_obj,
        movement_type=MovementType.DUPLICADO,
        previous_status=previous_status,
        new_status=SerialStatus.DUPLICADO,
        source_table="serials",
        source_id=serial_obj.id,
        cav_id=serial_obj.cav_id,
        user_id=current_user.id,
        notes=payload.notes or "Marcado manualmente como duplicado.",
    )
    register_audit_log(
        db,
        action="mark_duplicate",
        entity="serial",
        entity_id=serial_obj.id,
        user_id=current_user.id,
        payload={"serial": payload.serial},
    )
    db.commit()
    db.refresh(serial_obj)
    return serial_obj
