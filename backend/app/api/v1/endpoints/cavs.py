from flask import Blueprint, request
from sqlalchemy import func, select

from app.api.deps import get_current_user, has_global_cav_access, login_required, require_roles
from app.api.utils import dump_schema, dump_schema_list, json_response, parse_body
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.enums import RoleName
from app.models.cav import CAV
from app.schemas.cav import CAVCreate, CAVRead, CAVUpdate
from app.services.audit_service import register_audit_log


cavs_bp = Blueprint("cavs", __name__)


def normalize_cav_payload(nombre_cav: str, centro_costos: str) -> dict[str, str]:
    return {
        "nombre_cav": nombre_cav.strip(),
        "centro_costos": centro_costos.strip(),
    }


@cavs_bp.get("/")
@login_required
def list_cavs():
    db = get_db()
    current_user = get_current_user(db)
    stmt = select(CAV).order_by(CAV.nombre_cav)
    if not has_global_cav_access(current_user):
        if current_user.cav_id is None:
            return json_response([])
        stmt = stmt.where(CAV.id == current_user.cav_id)
    cavs = list(db.scalars(stmt))
    return json_response(dump_schema_list([CAVRead.model_validate(cav) for cav in cavs]))


@cavs_bp.post("/")
@require_roles(RoleName.SUPERADMIN)
def create_cav():
    payload = parse_body(CAVCreate)
    db = get_db()
    current_user = get_current_user(db)
    cav_data = normalize_cav_payload(payload.nombre_cav, payload.centro_costos)
    existing_cav = db.scalar(
        select(CAV).where(func.lower(CAV.nombre_cav) == cav_data["nombre_cav"].lower())
    )
    if existing_cav:
        raise ApiError("Ya existe un CAV con ese nombre.", 409)

    cav = CAV(**cav_data)
    db.add(cav)
    db.flush()
    register_audit_log(
        db,
        action="create_cav",
        entity="cav",
        entity_id=cav.id,
        user_id=current_user.id,
        payload=cav_data,
        request=request,
    )
    db.commit()
    db.refresh(cav)
    return json_response(dump_schema(CAVRead.model_validate(cav)), 201)


@cavs_bp.put("/<int:cav_id>")
@require_roles(RoleName.SUPERADMIN)
def update_cav(cav_id: int):
    payload = parse_body(CAVUpdate)
    db = get_db()
    current_user = get_current_user(db)
    cav = db.get(CAV, cav_id)
    if not cav:
        raise ApiError("CAV no encontrado.", 404)
    changes = payload.model_dump(exclude_unset=True)
    if "nombre_cav" in changes or "centro_costos" in changes:
        normalized = normalize_cav_payload(
            changes.get("nombre_cav", cav.nombre_cav),
            changes.get("centro_costos", cav.centro_costos),
        )
        changes.update(
            {
                key: value
                for key, value in normalized.items()
                if key in changes
            }
        )
    if "nombre_cav" in changes:
        existing_cav = db.scalar(
            select(CAV).where(func.lower(CAV.nombre_cav) == changes["nombre_cav"].lower(), CAV.id != cav_id)
        )
        if existing_cav:
            raise ApiError("Ya existe un CAV con ese nombre.", 409)

    for field, value in changes.items():
        setattr(cav, field, value)
    register_audit_log(
        db,
        action="update_cav",
        entity="cav",
        entity_id=cav.id,
        user_id=current_user.id,
        payload=changes,
        request=request,
    )
    db.commit()
    db.refresh(cav)
    return json_response(dump_schema(CAVRead.model_validate(cav)))


@cavs_bp.delete("/<int:cav_id>")
@require_roles(RoleName.SUPERADMIN)
def delete_cav(cav_id: int):
    db = get_db()
    current_user = get_current_user(db)
    cav = db.get(CAV, cav_id)
    if not cav:
        raise ApiError("CAV no encontrado.", 404)
    register_audit_log(
        db,
        action="delete_cav",
        entity="cav",
        entity_id=cav.id,
        user_id=current_user.id,
        payload={"nombre_cav": cav.nombre_cav},
        request=request,
    )
    db.delete(cav)
    db.commit()
    return ("", 204)
