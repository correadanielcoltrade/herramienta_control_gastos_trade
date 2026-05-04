from flask import Blueprint

from app.api.deps import get_current_user, login_required
from app.api.utils import dump_schema, json_response, parse_body
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth_service import authenticate_user


auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/login")
def login():
    payload = parse_body(LoginRequest)
    db = get_db()
    user = authenticate_user(db, payload.correo, payload.password)
    if not user:
        raise ApiError("Correo o contrasena invalida.", 401)
    token = create_access_token(str(user.id))
    response = TokenResponse(access_token=token, user=UserRead.model_validate(user))
    return json_response(dump_schema(response))


@auth_bp.get("/me")
@login_required
def me():
    current_user = get_current_user()
    return json_response(dump_schema(UserRead.model_validate(current_user)))
