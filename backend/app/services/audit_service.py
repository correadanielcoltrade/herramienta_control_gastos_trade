from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def register_audit_log(
    db: Session,
    action: str,
    entity: str,
    entity_id: int | None,
    user_id: int | None,
    payload: dict | None = None,
    request=None,
) -> None:
    log = AuditLog(
        action=action,
        entity=entity,
        entity_id=entity_id,
        user_id=user_id,
        payload=payload,
        ip_address=getattr(request, "remote_addr", None),
    )
    db.add(log)
