import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationChannel, NotificationStatus, NotificationType
from app.models.user import User
from app.services import email_service, email_templates
from app.services import notification_constants as const

logger = logging.getLogger("ihg.notification_processor")


def _attachments_for(db: Session, notification: Notification) -> list[tuple[bytes, str, str]]:
    """An invoice email carries the invoice itself as a PDF. If it can't be
    built, the email still goes out — a receipt in the inbox beats no email
    at all."""
    if notification.notification_type != NotificationType.INVOICE_CREATED:
        return []
    if notification.related_entity_type != "invoice" or not notification.related_entity_id:
        return []
    try:
        from app.services import invoice_pdf_service
        result = invoice_pdf_service.build_invoice_pdf(db, notification.related_entity_id)
        if not result:
            return []
        content, filename = result
        return [(content, filename, "pdf")]
    except Exception:
        logger.exception("Could not attach invoice PDF to notification %s", notification.id)
        return []


def process_pending_emails(db: Session, limit: int = 50) -> dict:
    """Plain callable function — NOT tied to FastAPI startup/lifespan.
    Invoked both by the background email worker and by the manual
    SUPER_ADMIN endpoint.

    Uses SELECT ... FOR UPDATE SKIP LOCKED so multiple concurrent callers
    (e.g. the worker and the manual endpoint at once) never double-process
    the same row."""
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

        # The in-app notification is one line; the email gets the full,
        # branded version built from the same event metadata.
        try:
            subject, html_body, text_body = email_templates.build(notification, recipient)
        except Exception:
            logger.exception("Email template failed for notification %s; using the plain message", notification.id)
            subject, html_body, text_body = notification.title, None, notification.message

        success, error = email_service.send_email(
            recipient.email, subject, text_body,
            html_body=html_body,
            attachments=_attachments_for(db, notification),
        )

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