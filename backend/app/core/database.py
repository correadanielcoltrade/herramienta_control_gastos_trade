from sqlalchemy import create_engine
from sqlalchemy.orm import Session, scoped_session, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.sqlalchemy_database_uri,
    future=True,
    pool_pre_ping=True,
)
SessionLocal = scoped_session(
    sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=Session,
    )
)


def get_db() -> Session:
    return SessionLocal()


def remove_db_session(exception: Exception | None = None) -> None:
    if SessionLocal.registry.has():
        db = SessionLocal()
        if exception:
            db.rollback()
        SessionLocal.remove()
