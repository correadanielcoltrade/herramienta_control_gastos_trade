from flask import Blueprint, request
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import (
    cav_ids_for_regional,
    ensure_cav_scope,
    get_current_user,
    has_global_cav_access,
    login_required,
    regional_scoped_cav_ids,
    require_roles,
)
from app.api.utils import (
    dump_schema,
    dump_schema_list,
    json_response,
    parse_body,
    parse_optional_date,
    parse_optional_enum,
    parse_optional_int,
)
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.enums import RoleName, SerialStatus
from app.models.serial import Serial
from app.models.serial_movement import SerialMovement
from app.schemas.serial import (
    AbastecimientoCreate,
    AbastecimientoUpdate,
    BlockedSerial,
    LegalizationCreate,
    LegalizationRead,
    MarkDuplicateRequest,
    ReceptionBatchCreate,
    ReceptionRead,
    ReceptionResult,
    SerialMovementRead,
    SerialRead,
    SupplyDeleteManyRequest,
    SupplyRead,
)
from app.services.serial_service import (
    delete_supplies,
    delete_supply,
    list_legalizations,
    list_receipts,
    list_supplies,
    mark_duplicate,
    register_legalization,
    register_receipts,
    register_supply,
    serialize_legalization,
    serialize_reception,
    serialize_supply,
    update_supply,
)


serials_bp = Blueprint("serials", __name__)


@serials_bp.get("/")
@login_required
def list_serials():
    cav_id = parse_optional_int("cav_id")
    status_filter = parse_optional_enum(SerialStatus, "status")
    user_id = parse_optional_int("user_id")
    serial = request.args.get("serial")
    regional = request.args.get("regional")
    db = get_db()
    current_user = get_current_user(db)
    stmt = select(Serial).options(joinedload(Serial.cav)).order_by(Serial.updated_at.desc())
    if cav_id:
        stmt = stmt.where(Serial.cav_id == cav_id)
    if status_filter:
        stmt = stmt.where(Serial.current_status == status_filter)
    if serial:
        stmt = stmt.where(Serial.serial.ilike(f"%{serial}%"))
    if user_id:
        stmt = stmt.where(Serial.created_by_id == user_id)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            return json_response([])
        stmt = stmt.where(Serial.cav_id == current_user.cav_id)
    regional_ids = regional_scoped_cav_ids(current_user, db)
    if regional_ids is not None:
        stmt = stmt.where(Serial.cav_id.in_(regional_ids))
    regional_filter_ids = cav_ids_for_regional(db, regional)
    if regional_filter_ids is not None:
        stmt = stmt.where(Serial.cav_id.in_(regional_filter_ids))
    serials = list(db.scalars(stmt))
    return json_response(dump_schema_list([SerialRead.model_validate(item) for item in serials]))


@serials_bp.get("/<int:serial_id>")
@login_required
def get_serial(serial_id: int):
    db = get_db()
    current_user = get_current_user(db)
    serial_obj = db.scalar(select(Serial).options(joinedload(Serial.cav)).where(Serial.id == serial_id))
    if not serial_obj:
        raise ApiError("Serial no encontrado.", 404)
    ensure_cav_scope(current_user, serial_obj.cav_id if serial_obj else None)
    return json_response(dump_schema(SerialRead.model_validate(serial_obj)))


@serials_bp.get("/<int:serial_id>/movements")
@login_required
def get_serial_movements(serial_id: int):
    db = get_db()
    current_user = get_current_user(db)
    serial_obj = db.get(Serial, serial_id)
    if not serial_obj:
        raise ApiError("Serial no encontrado.", 404)
    ensure_cav_scope(current_user, serial_obj.cav_id if serial_obj else None)
    movements = list(
        db.scalars(
            select(SerialMovement)
            .where(SerialMovement.serial_id == serial_id)
            .order_by(SerialMovement.created_at.desc())
        )
    )
    return json_response(dump_schema_list([SerialMovementRead.model_validate(item) for item in movements]))


@serials_bp.post("/supplies")
@require_roles(
    RoleName.SUPERADMIN,
    RoleName.OPS,
    RoleName.TRADE,
    RoleName.TRADE_MANAGER,
    RoleName.SUPERNUMERARIO,
)
def create_supply():
    payload = parse_body(AbastecimientoCreate)
    db = get_db()
    current_user = get_current_user(db)
    supply = register_supply(db, payload, current_user)
    return json_response(dump_schema(serialize_supply(supply)), 201)


@serials_bp.get("/supplies")
@login_required
def get_supplies():
    db = get_db()
    current_user = get_current_user(db)
    cav_id = parse_optional_int("cav_id")
    end_date = parse_optional_date("end_date")
    producto = request.args.get("producto")
    serial = request.args.get("serial")
    start_date = parse_optional_date("start_date")
    status_filter = parse_optional_enum(SerialStatus, "status")
    user_id = parse_optional_int("user_id")
    regional = request.args.get("regional")
    supplies = list_supplies(
        db,
        current_user=current_user,
        cav_id=cav_id,
        end_date=end_date,
        producto=producto,
        serial=serial,
        start_date=start_date,
        status=status_filter,
        user_id=user_id,
        regional=regional,
    )
    return json_response(dump_schema_list([serialize_supply(item) for item in supplies]))


@serials_bp.put("/supplies/<int:supply_id>")
@require_roles(
    RoleName.SUPERADMIN,
    RoleName.OPS,
    RoleName.TRADE,
    RoleName.TRADE_MANAGER,
    RoleName.SUPERNUMERARIO,
)
def edit_supply(supply_id: int):
    payload = parse_body(AbastecimientoUpdate)
    db = get_db()
    current_user = get_current_user(db)
    supply = update_supply(db, supply_id=supply_id, payload=payload, current_user=current_user)
    return json_response(dump_schema(serialize_supply(supply)))


@serials_bp.delete("/supplies/<int:supply_id>")
@require_roles(
    RoleName.SUPERADMIN,
    RoleName.OPS,
    RoleName.TRADE,
    RoleName.TRADE_MANAGER,
    RoleName.SUPERNUMERARIO,
)
def remove_supply(supply_id: int):
    db = get_db()
    current_user = get_current_user(db)
    delete_supply(db, supply_id=supply_id, current_user=current_user)
    return json_response({"deleted": 1})


@serials_bp.post("/supplies/delete-batch")
@require_roles(
    RoleName.SUPERADMIN,
    RoleName.OPS,
    RoleName.TRADE,
    RoleName.TRADE_MANAGER,
    RoleName.SUPERNUMERARIO,
)
def remove_supply_batch():
    payload = parse_body(SupplyDeleteManyRequest)
    db = get_db()
    current_user = get_current_user(db)
    deleted = delete_supplies(db, payload=payload, current_user=current_user)
    return json_response({"deleted": deleted})


@serials_bp.post("/receipts")
@login_required
def create_receipt_batch():
    payload = parse_body(ReceptionBatchCreate)
    db = get_db()
    current_user = get_current_user(db)
    processed, pending, duplicates, blocked = register_receipts(db, payload, current_user)
    response = ReceptionResult(
        procesados=[SerialRead.model_validate(item) for item in processed],
        pendientes=[SerialRead.model_validate(item) for item in pending],
        duplicados=duplicates,
        bloqueados=[BlockedSerial(**b) for b in blocked],
    )
    return json_response(dump_schema(response), 201)


@serials_bp.get("/receipts")
@login_required
def get_receipts():
    db = get_db()
    current_user = get_current_user(db)
    receipts = list_receipts(db, current_user=current_user)
    return json_response(dump_schema_list([serialize_reception(item) for item in receipts]))


@serials_bp.post("/legalizations")
@require_roles(
    RoleName.SUPERADMIN,
    RoleName.OPS,
    RoleName.QUALITY,
    RoleName.TRADE,
    RoleName.TRADE_MANAGER,
    RoleName.ASESOR,
    RoleName.SUPERNUMERARIO,
)
def create_legalization():
    payload = parse_body(LegalizationCreate)
    db = get_db()
    current_user = get_current_user(db)
    serial_obj = register_legalization(db, payload, current_user)
    return json_response(dump_schema(SerialRead.model_validate(serial_obj)), 201)


@serials_bp.get("/legalizations")
@login_required
def get_legalizations():
    db = get_db()
    current_user = get_current_user(db)
    cav_id = parse_optional_int("cav_id")
    end_date = parse_optional_date("end_date")
    start_date = parse_optional_date("start_date")
    user_id = parse_optional_int("user_id")
    regional = request.args.get("regional")
    legalizations = list_legalizations(
        db,
        current_user=current_user,
        cav_id=cav_id,
        end_date=end_date,
        start_date=start_date,
        user_id=user_id,
        regional=regional,
    )
    return json_response(dump_schema_list([serialize_legalization(item) for item in legalizations]))


@serials_bp.post("/duplicates")
@require_roles(RoleName.SUPERADMIN, RoleName.OPS, RoleName.SUPERNUMERARIO)
def flag_duplicate():
    payload = parse_body(MarkDuplicateRequest)
    db = get_db()
    current_user = get_current_user(db)
    serial_obj = mark_duplicate(db, payload, current_user)
    return json_response(dump_schema(SerialRead.model_validate(serial_obj)), 201)
