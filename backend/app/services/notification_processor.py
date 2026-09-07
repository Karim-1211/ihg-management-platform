from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationChannel, NotificationStatus
from app.models.user import User
from app.services import email_service
from app.services import notification_constants as const


def process_pending_emails(db: Session, limit: int = 50) -> dict:
    """Plain callable function — NOT tied to FastAPI startup/lifespan.
    Invoked via the manual SUPER_ADMIN endpoint for now; production
    scheduling (cron/worker) is deferred to a later deployment phase.

    Uses SELECT ... FOR UPDATE SKIP LOCKED so multiple concurrent callers
    (e.g. the manual endpoint fired twice) never double-process the same row."""
    pending = (
        db.query(Notification)
        .filter(Notification.channel == NotificationChannel.EMAIL, Notification.status == NotificationStatus.PENDING)
        .with_for_update(skip_locked=True)
        .limit(limit)
        .all()
    )

    sent_count = 0
    failed_count = 0

    for notification in pending:
        recipient = db.query(User).filter(User.id == notification.recipient_user_id).first()
        notification.attempts += 1
        notification.last_attempt_at = datetime.now(timezone.utc)

        if not recipient:
            notification.status = NotificationStatus.FAILED
            notification.failure_reason = "Recipient user no longer exists."
            failed_count += 1
            continue

        success, error = email_service.send_email(recipient.email, notification.title, notification.message)

        if success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now(timezone.utc)
            sent_count += 1
        else:
            if notification.attempts >= const.MAX_EMAIL_ATTEMPTS:
                notification.status = NotificationStatus.FAILED
                notification.failure_reason = error or "Unknown error."
                failed_count += 1
            # else: stays PENDING, will be retried on next processor run

    db.commit()
    return {"processed": len(pending), "sent": sent_count, "failed": failed_count}