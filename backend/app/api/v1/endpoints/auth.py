import secrets
from datetime import datetime, timedelta

from flask import Blueprint
from sqlalchemy import select

from app.api.deps import get_current_user, login_required
from app.api.utils import dump_schema, json_response, parse_body
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.security import create_access_token, get_password_hash
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services.auth_service import authenticate_user
from app.services.email_service import EmailService


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


@auth_bp.post("/forgot-password")
def forgot_password():
    payload = parse_body(ForgotPasswordRequest)
    db = get_db()

    user = db.scalar(select(User).where(User.correo == payload.correo))
    if not user:
        raise ApiError("Correo no registrado.", 404)

    # Generar token único
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.password_reset_expire_minutes)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(reset_token)
    db.commit()

    # Construir link de recuperación
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

    # Enviar email
    email_sent = EmailService.send_password_reset_email(
        recipient_email=user.correo,
        reset_link=reset_link,
        user_name=user.nombre_usuario,
    )

    if not email_sent:
        raise ApiError("Error enviando correo de recuperación.", 500)

    response = ForgotPasswordResponse(
        message=f"Se envió un correo de recuperación a {user.correo}. Válido por 30 minutos."
    )
    return json_response(dump_schema(response))


@auth_bp.post("/reset-password")
def reset_password():
    payload = parse_body(ResetPasswordRequest)
    db = get_db()

    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.token)
    )

    if not reset_token:
        raise ApiError("Token de recuperación inválido.", 400)

    if reset_token.used:
        raise ApiError("Este token ya fue utilizado.", 400)

    if datetime.utcnow() > reset_token.expires_at:
        raise ApiError("Token de recuperación expirado.", 400)

    user = db.get(User, reset_token.user_id)
    if not user:
        raise ApiError("Usuario no encontrado.", 404)

    # Actualizar contraseña
    user.password_hash = get_password_hash(payload.password)
    reset_token.used = True

    db.commit()

    response = ResetPasswordResponse(message="Contraseña actualizada correctamente.")
    return json_response(dump_schema(response))
