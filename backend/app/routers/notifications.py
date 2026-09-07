import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.notification import NotificationType
from app.schemas.notification import (
    NotificationResponse, UnreadCountResponse,
    NotificationPreferenceResponse, NotificationPreferenceUpdate,
    EmailLogResponse,
)
from app.services import notification_service
from app.services import notification_processor

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.list_notifications(db, current_user.id, unread_only)


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = notification_service.get_unread_count(db, current_user.id)
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.mark_read(db, notification_id, current_user.id)


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = notification_service.mark_all_read(db, current_user.id)
    return {"updated": updated}


@router.get("/preferences", response_model=list[NotificationPreferenceResponse])
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.get_preferences(db, current_user.id)


@router.put("/preferences")
def update_preference(
    data: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification_service.update_preference(db, current_user.id, data.notification_type, data.email_enabled)
    return {"status": "updated"}


@router.get("/email-log", response_model=list[EmailLogResponse])
def email_log(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return notification_service.list_email_log(db)


@router.post("/process-pending")
def process_pending(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return notification_processor.process_pending_emails(db)


@router.post("/{notification_id}/force-fail", response_model=NotificationResponse)
def force_fail(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return notification_service.force_fail(db, notification_id)


from app.schemas.notification_event import NotificationEvent


@router.post("/test-dispatch")
def test_dispatch(
    event: NotificationEvent,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    """Dev/test-only: fires an arbitrary NotificationEvent directly, bypassing
    any real business service. Used only for isolated Phase 15 verification
    before business-service integration exists."""
    notification_service.dispatch(db, event)
    return {"status": "dispatched"}