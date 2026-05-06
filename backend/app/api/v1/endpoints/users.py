from flask import Blueprint, request
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user, require_roles
from app.api.utils import dump_schema, dump_schema_list, json_response, parse_body
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.enums import RoleName
from app.core.security import get_password_hash
from app.models.role import Role
from app.models.user import User
from app.schemas.user import RoleRead, UserCreate, UserRead, UserUpdate
from app.services.audit_service import register_audit_log


users_bp = Blueprint("users", __name__)


def normalize_email(email: str) -> str:
    return email.strip().lower()


TRADE_LEADER_ROLES = {RoleName.TRADE.value, RoleName.TRADE_LEADER.value}
ADMIN_ACCESS_ROLES = (RoleName.SUPERADMIN, RoleName.TRADE, RoleName.TRADE_LEADER)
# Roles que un Trade/Trade Leader puede ver, crear y editar
TRADE_MANAGEABLE_ROLES = {
    RoleName.ASESOR.value,
    RoleName.TRADE.value,
    RoleName.TRADE_LEADER.value,
}


def _is_trade_leader(role_name: str) -> bool:
    return role_name in TRADE_LEADER_ROLES


@users_bp.get("/roles")
@require_roles(*ADMIN_ACCESS_ROLES)
def list_roles():
    db = get_db()
    current_user = get_current_user(db)
    query = select(Role).order_by(Role.id)
    # Trade/Trade Leader solo ve los roles Asesor, Trade y Trade Leader
    if _is_trade_leader(current_user.role.name):
        query = query.where(Role.name.in_(TRADE_MANAGEABLE_ROLES))
    roles = list(db.scalars(query))
    return json_response(dump_schema_list([RoleRead.model_validate(role) for role in roles]))


@users_bp.get("/")
@require_roles(*ADMIN_ACCESS_ROLES)
def list_users():
    db = get_db()
    current_user = get_current_user(db)
    query = select(User).options(joinedload(User.role), joinedload(User.cav)).order_by(User.id)
    # Trade/Trade Leader solo ve usuarios con rol Asesor, Trade o Trade Leader
    if _is_trade_leader(current_user.role.name):
        query = query.join(Role).where(Role.name.in_(TRADE_MANAGEABLE_ROLES))
    users = list(db.scalars(query))
    return json_response(dump_schema_list([UserRead.model_validate(user) for user in users]))


@users_bp.post("/")
@require_roles(*ADMIN_ACCESS_ROLES)
def create_user():
    payload = parse_body(UserCreate)
    db = get_db()
    current_user = get_current_user(db)
    normalized_email = normalize_email(payload.correo)
    if db.scalar(select(User).where(func.lower(User.correo) == normalized_email)):
        raise ApiError("El correo ya existe.", 409)

    role = db.get(Role, payload.role_id)
    if not role:
        raise ApiError("Rol no encontrado.", 404)

    # Trade/Trade Leader solo puede crear usuarios con rol Asesor o Trade
    if _is_trade_leader(current_user.role.name) and role.name not in TRADE_MANAGEABLE_ROLES:
        raise ApiError("Solo puedes crear usuarios con rol Asesor o Trade.", 403)

    if role.name != RoleName.SUPERNUMERARIO.value and payload.cav_id is None:
        raise ApiError("El usuario requiere un CAV asignado.", 400)

    user = User(
        nombre_usuario=payload.nombre_usuario,
        correo=normalized_email,
        password_hash=get_password_hash(payload.password),
        role_id=payload.role_id,
        cav_id=payload.cav_id,
        is_active=payload.is_active,
    )
    db.add(user)
    db.flush()
    register_audit_log(
        db,
        action="create_user",
        entity="user",
        entity_id=user.id,
        user_id=current_user.id,
        payload={"correo": normalized_email, "role_id": payload.role_id},
        request=request,
    )
    db.commit()
    db.refresh(user)
    user = db.scalar(
        select(User).options(joinedload(User.role), joinedload(User.cav)).where(User.id == user.id)
    )
    return json_response(dump_schema(UserRead.model_validate(user)), 201)


@users_bp.put("/<int:user_id>")
@require_roles(*ADMIN_ACCESS_ROLES)
def update_user(user_id: int):
    payload = parse_body(UserUpdate)
    db = get_db()
    current_user = get_current_user(db)
    user = db.scalar(
        select(User).options(joinedload(User.role), joinedload(User.cav)).where(User.id == user_id)
    )
    if not user:
        raise ApiError("Usuario no encontrado.", 404)

    # Trade/Trade Leader solo puede editar usuarios con rol Asesor o Trade
    if _is_trade_leader(current_user.role.name) and user.role.name not in TRADE_MANAGEABLE_ROLES:
        raise ApiError("Solo puedes editar usuarios con rol Asesor o Trade.", 403)

    changes = payload.model_dump(exclude_unset=True)
    if "correo" in changes:
        changes["correo"] = normalize_email(changes["correo"])
        existing = db.scalar(
            select(User).where(func.lower(User.correo) == changes["correo"], User.id != user_id)
        )
        if existing:
            raise ApiError("El correo ya existe.", 409)
    if "password" in changes:
        user.password_hash = get_password_hash(changes.pop("password"))
    if "role_id" in changes:
        role = db.get(Role, changes["role_id"])
        if not role:
            raise ApiError("Rol no encontrado.", 404)
        # Trade/Trade Leader solo puede asignar roles Asesor o Trade
        if _is_trade_leader(current_user.role.name) and role.name not in TRADE_MANAGEABLE_ROLES:
            raise ApiError("Solo puedes asignar el rol Asesor o Trade.", 403)
        if role.name != RoleName.SUPERNUMERARIO.value and changes.get("cav_id", user.cav_id) is None:
            raise ApiError("El usuario requiere un CAV asignado.", 400)
    for field, value in changes.items():
        setattr(user, field, value)
    register_audit_log(
        db,
        action="update_user",
        entity="user",
        entity_id=user.id,
        user_id=current_user.id,
        payload={k: v for k, v in changes.items() if k != "password_hash"},
        request=request,
    )
    db.commit()
    db.refresh(user)
    return json_response(dump_schema(UserRead.model_validate(user)))
