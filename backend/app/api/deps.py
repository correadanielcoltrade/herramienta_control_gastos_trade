from collections.abc import Callable
from functools import wraps

from flask import g, request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.errors import ApiError
from app.core.enums import RoleName
from app.core.security import decode_access_token
from app.models.user import User

GLOBAL_CAV_ROLE_NAMES = {
    RoleName.SUPERADMIN.value,
    RoleName.OPS.value,
    RoleName.QUALITY.value,
    RoleName.TRADE.value,
    RoleName.TRADE_LEADER.value,
    RoleName.SUPERNUMERARIO.value,
}


def normalize_role_name(role_name: str | None) -> str:
    return " ".join((role_name or "").strip().split()).casefold()


def attach_auth_context() -> None:
    g.token_payload = extract_bearer_token(request)
    g.current_user = None


def get_token_payload() -> dict:
    payload = getattr(g, "token_payload", None)
    if not payload:
        raise ApiError("Credenciales invalidas o expiradas.", 401)
    return payload


def get_current_user(db: Session | None = None) -> User:
    current_user = getattr(g, "current_user", None)
    if current_user is not None:
        return current_user

    db = db or get_db()
    token_payload = get_token_payload()
    user_id = token_payload.get("sub")
    stmt = (
        select(User)
        .options(joinedload(User.role), joinedload(User.cav))
        .where(User.id == int(user_id))
    )
    user = db.scalar(stmt)
    if not user or not user.is_active:
        raise ApiError("Usuario no autorizado.", 401)
    g.current_user = user
    return user


def login_required(view: Callable) -> Callable:
    @wraps(view)
    def wrapper(*args, **kwargs):
        get_current_user()
        return view(*args, **kwargs)

    return wrapper


def require_roles(*roles: RoleName) -> Callable:
    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            current_user = get_current_user()
            allowed = {normalize_role_name(role.value) for role in roles}
            user_role = normalize_role_name(current_user.role.name)
            if roles and user_role not in allowed:
                raise ApiError("No cuentas con permisos para esta accion.", 403)
            return view(*args, **kwargs)

        return wrapper

    return decorator


def has_global_cav_access(current_user: User) -> bool:
    allowed = {normalize_role_name(role_name) for role_name in GLOBAL_CAV_ROLE_NAMES}
    return normalize_role_name(current_user.role.name) in allowed


def ensure_cav_scope(current_user: User, cav_id: int | None) -> None:
    if has_global_cav_access(current_user):
        return
    if cav_id is None or current_user.cav_id != cav_id:
        raise ApiError("Este usuario no puede operar fuera de su CAV.", 403)


def extract_bearer_token(incoming_request) -> dict | None:
    auth_header = incoming_request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.removeprefix("Bearer ").strip()
    return decode_access_token(token)
