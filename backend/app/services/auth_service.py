from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.security import verify_password
from app.models.user import User


def authenticate_user(db: Session, correo: str, password: str) -> User | None:
    normalized_email = correo.strip().lower()
    stmt = (
        select(User)
        .options(joinedload(User.role), joinedload(User.cav))
        .where(func.lower(User.correo) == normalized_email)
    )
    user = db.scalar(stmt)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
