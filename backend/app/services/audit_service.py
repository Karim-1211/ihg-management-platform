import uuid

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def log_action(
    db: Session,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None,
    description: str,
) -> None:
    """Records an audit entry. Commits independently so a logging failure
    never blocks the primary business operation that already succeeded."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(entry)
    db.commit()


def _attach_user_name(db: Session, entry: AuditLog) -> AuditLog:
    if entry.user_id:
        user = db.query(User).filter(User.id == entry.user_id).first()
        if user:
            entry.user_name = f"{user.first_name} {user.last_name}"
    return entry


def list_audit_logs(db: Session, limit: int = 200) -> list[AuditLog]:
    entries = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [_attach_user_name(db, e) for e in entries]