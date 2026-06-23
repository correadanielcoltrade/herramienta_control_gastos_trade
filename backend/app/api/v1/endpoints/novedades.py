from flask import Blueprint, request

from app.api.deps import get_current_user, require_roles
from app.api.utils import dump_schema, dump_schema_list, json_response, parse_body
from app.core.database import get_db
from app.core.enums import RoleName
from app.schemas.novedad import AprobarNovedadRequest, DarDeBajaRequest, OpsResolverRequest
from app.services import novedad_service


novedades_bp = Blueprint("novedades", __name__)

TRADE_ROLES = (RoleName.SUPERADMIN, RoleName.TRADE, RoleName.TRADE_MANAGER)
OPS_ROLES = (RoleName.SUPERADMIN, RoleName.OPS)


@novedades_bp.get("/")
@require_roles(*TRADE_ROLES)
def list_novedades():
    db = get_db()
    current_user = get_current_user(db)
    cav_id = request.args.get("cav_id", type=int)
    regional = request.args.get("regional")
    items = novedad_service.list_novedades(
        db, current_user=current_user, cav_id=cav_id, regional=regional
    )
    return json_response(dump_schema_list(items))


@novedades_bp.get("/bajas")
@require_roles(*TRADE_ROLES)
def list_bajas():
    db = get_db()
    current_user = get_current_user(db)
    cav_id = request.args.get("cav_id", type=int)
    regional = request.args.get("regional")
    items = novedad_service.list_bajas(
        db, current_user=current_user, cav_id=cav_id, regional=regional
    )
    return json_response(dump_schema_list(items))


@novedades_bp.post("/<int:serial_id>/dar-de-baja")
@require_roles(*TRADE_ROLES)
def dar_de_baja(serial_id: int):
    payload = parse_body(DarDeBajaRequest)
    db = get_db()
    current_user = get_current_user(db)
    novedad_service.dar_de_baja(
        db, serial_id=serial_id, observacion=payload.observacion, current_user=current_user
    )
    return json_response({"deleted": 1})


@novedades_bp.post("/<int:serial_id>/aprobar")
@require_roles(*TRADE_ROLES)
def aprobar(serial_id: int):
    payload = parse_body(AprobarNovedadRequest)
    db = get_db()
    current_user = get_current_user(db)
    resolucion = novedad_service.aprobar_novedad(
        db, serial_id=serial_id, payload=payload, current_user=current_user
    )
    return json_response(dump_schema(novedad_service.serialize_resolucion(db, resolucion)), 201)


@novedades_bp.get("/aprobaciones")
@require_roles(*OPS_ROLES)
def list_aprobaciones():
    db = get_db()
    get_current_user(db)
    return json_response(dump_schema_list(novedad_service.list_aprobaciones_ops(db)))


@novedades_bp.post("/aprobaciones/<int:resolucion_id>/aprobar")
@require_roles(*OPS_ROLES)
def aprobar_ingreso(resolucion_id: int):
    payload = parse_body(OpsResolverRequest)
    db = get_db()
    current_user = get_current_user(db)
    novedad_service.ops_aprobar(
        db, resolucion_id=resolucion_id, observacion=payload.observacion, current_user=current_user
    )
    return json_response({"ok": True})


@novedades_bp.post("/aprobaciones/<int:resolucion_id>/rechazar")
@require_roles(*OPS_ROLES)
def rechazar_ingreso(resolucion_id: int):
    payload = parse_body(OpsResolverRequest)
    db = get_db()
    current_user = get_current_user(db)
    novedad_service.ops_rechazar(
        db, resolucion_id=resolucion_id, observacion=payload.observacion, current_user=current_user
    )
    return json_response({"ok": True})
