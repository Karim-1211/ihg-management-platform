import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.notification import (
    Notification, NotificationPreference, NotificationType, NotificationChannel,
    NotificationStatus, NotificationPriority,
)
from app.models.user import User, RoleEnum
from app.schemas.notification_event import NotificationEvent
from app.services import notification_constants as const

# Namespace UUID for deterministic event_id derivation — fixed constant,
# never changes, so the same (entity_type, entity_id, notification_type)
# always produces the same event_id across repeated calls.
_EVENT_NAMESPACE = uuid.UUID("6f1f9b2a-6b1a-4b7a-9c3e-2b7a6f1f9b2a")


def _derive_event_id(event: NotificationEvent) -> uuid.UUID:
    key = f"{event.entity_type}:{event.entity_id}:{event.event_type.value}"
    return uuid.uuid5(_EVENT_NAMESPACE, key)


def _resolve_recipients(db: Session, event: NotificationEvent) -> list[uuid.UUID]:
    """Per-event-type recipient resolution. Returns a list of user IDs.
    Never raises — an unresolvable recipient set just means no notification
    is created, it must never block the calling business transaction."""
    event_type = event.event_type
    recipients: list[uuid.UUID] = []

    guest_or_customer_events = {
        NotificationType.BOOKING_CONFIRMED, NotificationType.BOOKING_CANCELLED,
        NotificationType.CHECK_IN_COMPLETED, NotificationType.CHECK_OUT_COMPLETED,
        NotificationType.SERVICE_REQUEST_COMPLETED, NotificationType.ORDER_SERVED,
        NotificationType.DELIVERY_OUT_FOR_DELIVERY, NotificationType.DELIVERY_DELIVERED,
        NotificationType.INVOICE_CREATED, NotificationType.PAYMENT_COMPLETED,
        NotificationType.PAYMENT_FAILED,
    }
    if event_type in guest_or_customer_events:
        customer_id = event.metadata.get("customer_id")
        if customer_id:
            recipients.append(uuid.UUID(str(customer_id)))
        return recipients

    if event_type == NotificationType.SERVICE_REQUEST_CREATED:
        if event.hotel_id:
            staff = db.query(User).filter(
                User.hotel_id == event.hotel_id,
                User.role.in_([RoleEnum.RECEPTIONIST, RoleEnum.HOUSEKEEPING]),
                User.is_active == True,  # noqa: E712
            ).all()
            recipients.extend([u.id for u in staff])
        return recipients

    if event_type == NotificationType.ORDER_CREATED:
        if event.restaurant_id:
            staff = db.query(User).filter(
                User.restaurant_id == event.restaurant_id,
                User.role == RoleEnum.KITCHEN,
                User.is_active == True,  # noqa: E712
            ).all()
            recipients.extend([u.id for u in staff])
        return recipients

    if event_type == NotificationType.ORDER_READY:
        if event.restaurant_id:
            staff = db.query(User).filter(
                User.restaurant_id == event.restaurant_id,
                User.role == RoleEnum.WAITER,
                User.is_active == True,  # noqa: E712
            ).all()
            recipients.extend([u.id for u in staff])
        customer_id = event.metadata.get("customer_id")
        if customer_id:
            recipients.append(uuid.UUID(str(customer_id)))
        return recipients

    if event_type == NotificationType.DELIVERY_ASSIGNED:
        driver_id = event.metadata.get("driver_id")
        if driver_id:
            recipients.append(uuid.UUID(str(driver_id)))
        return recipients

    if event_type == NotificationType.LOW_STOCK_ALERT:
        # Phase 15 routing shortcut, not a permanent ownership model — see
        # spec note. Real hotel/restaurant management policy is Phase 18.
        managers: list[User] = []
        if event.hotel_id:
            managers = db.query(User).filter(
                User.hotel_id == event.hotel_id,
                User.role == RoleEnum.MANAGER,
                User.is_active == True,  # noqa: E712
            ).all()
        if not managers:
            managers = db.query(User).filter(
                User.role == RoleEnum.SUPER_ADMIN,
                User.is_active == True,  # noqa: E712
            ).all()
        recipients.extend([u.id for u in managers])
        return recipients

    return recipients


def _get_email_preference(db: Session, user_id: uuid.UUID, notification_type: NotificationType) -> bool:
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.notification_type == notification_type,
    ).first()
    if pref is None:
        return const.DEFAULT_EMAIL_ENABLED
    return pref.email_enabled


def dispatch(db: Session, event: NotificationEvent) -> None:
    """Single entry point for every business service. MUST be called strictly
    after the caller's own db.commit(). Never raises — any failure here is
    swallowed and logged, since a notification problem must never roll back
    or affect the business transaction that already succeeded."""
    try:
        event_id = _derive_event_id(event)
        recipients = _resolve_recipients(db, event)
        if not recipients:
            return

        title, message = const.render_template(event.event_type, event.metadata)
        now = datetime.now(timezone.utc)

        for recipient_id in recipients:
            in_app_stmt = pg_insert(Notification).values(
                id=uuid.uuid4(),
                event_id=event_id,
                recipient_user_id=recipient_id,
                notification_type=event.event_type,
                channel=NotificationChannel.IN_APP,
                title=title,
                message=message,
                priority=NotificationPriority.NORMAL,
                status=NotificationStatus.SENT,
                related_entity_type=event.entity_type,
                related_entity_id=event.entity_id,
                hotel_id=event.hotel_id,
                restaurant_id=event.restaurant_id,
                metadata_json=event.metadata,
                sent_at=now,
            ).on_conflict_do_nothing(
                index_elements=["event_id", "recipient_user_id", "channel"]
            )
            db.execute(in_app_stmt)

            is_mandatory = event.event_type in const.MANDATORY_EMAIL_TYPES
            email_allowed = is_mandatory or _get_email_preference(db, recipient_id, event.event_type)

            if email_allowed:
                email_stmt = pg_insert(Notification).values(
                    id=uuid.uuid4(),
                    event_id=event_id,
                    recipient_user_id=recipient_id,
                    notification_type=event.event_type,
                    channel=NotificationChannel.EMAIL,
                    title=title,
                    message=message,
                    priority=NotificationPriority.NORMAL,
                    status=NotificationStatus.PENDING,
                    related_entity_type=event.entity_type,
                    related_entity_id=event.entity_id,
                    hotel_id=event.hotel_id,
                    restaurant_id=event.restaurant_id,
                    metadata_json=event.metadata,
                ).on_conflict_do_nothing(
                    index_elements=["event_id", "recipient_user_id", "channel"]
                )
                db.execute(email_stmt)

        db.commit()

    except Exception:
        db.rollback()
        # Deliberately swallowed. In a real deployment this would go to a
        # logger/monitoring system. It must never propagate to the caller.
        pass


# ---------- Notification Center API-facing functions ----------

def list_notifications(
    db: Session, user_id: uuid.UUID, unread_only: bool = False, limit: int = 50, offset: int = 0
) -> list[Notification]:
    """Phase 19.2: added optional offset for pagination, so a full-page
    history view (not just the bell dropdown's recent-N) can page through
    a customer's entire notification history. Existing callers that don't
    pass offset are unaffected (defaults to 0, identical to prior behavior)."""
    query = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.channel == NotificationChannel.IN_APP,
    )
    if unread_only:
        query = query.filter(Notification.status != NotificationStatus.READ)
    return query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


def get_unread_count(db: Session, user_id: uuid.UUID) -> int:
    return db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.channel == NotificationChannel.IN_APP,
        Notification.status != NotificationStatus.READ,
    ).count()


def mark_read(db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification:
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_user_id == user_id,
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.status = NotificationStatus.READ
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    updated = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.channel == NotificationChannel.IN_APP,
        Notification.status != NotificationStatus.READ,
    ).update({"status": NotificationStatus.READ, "read_at": datetime.now(timezone.utc)})
    db.commit()
    return updated


def get_preferences(db: Session, user_id: uuid.UUID) -> list[dict]:
    existing = {
        p.notification_type: p.email_enabled
        for p in db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).all()
    }
    return [
        {"notification_type": nt, "email_enabled": existing.get(nt, const.DEFAULT_EMAIL_ENABLED)}
        for nt in NotificationType
    ]


def update_preference(db: Session, user_id: uuid.UUID, notification_type: NotificationType, email_enabled: bool) -> None:
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id,
        NotificationPreference.notification_type == notification_type,
    ).first()
    if pref:
        pref.email_enabled = email_enabled
    else:
        pref = NotificationPreference(user_id=user_id, notification_type=notification_type, email_enabled=email_enabled)
        db.add(pref)
    db.commit()


def list_email_log(db: Session, limit: int = 100) -> list[dict]:
    rows = (
        db.query(Notification, User.email)
        .join(User, Notification.recipient_user_id == User.id)
        .filter(Notification.channel == NotificationChannel.EMAIL)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for notification, recipient_email in rows:
        notification.recipient_email = recipient_email
        results.append(notification)
    return results


def force_fail(db: Session, notification_id: uuid.UUID) -> Notification:
    """Dev/test-only: directly marks an email notification as FAILED with a
    synthetic reason, without touching the actual email pipeline. Used to
    prove that a failed notification never affects its related business
    record."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.channel == NotificationChannel.EMAIL,
    ).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email notification not found.")
    notification.status = NotificationStatus.FAILED
    notification.failure_reason = "Forced failure for testing (force-fail endpoint)."
    notification.attempts = const.MAX_EMAIL_ATTEMPTS
    notification.last_attempt_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification