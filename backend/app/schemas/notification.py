import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType, NotificationChannel, NotificationStatus, NotificationPriority


class NotificationResponse(BaseModel):
    id: uuid.UUID
    notification_type: NotificationType
    channel: NotificationChannel
    title: str
    message: str
    priority: NotificationPriority
    status: NotificationStatus
    related_entity_type: str | None
    related_entity_id: uuid.UUID | None
    metadata_json: dict | None
    created_at: datetime
    sent_at: datetime | None
    read_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferenceResponse(BaseModel):
    notification_type: NotificationType
    email_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceUpdate(BaseModel):
    notification_type: NotificationType
    email_enabled: bool


class EmailLogResponse(BaseModel):
    id: uuid.UUID
    recipient_email: str
    notification_type: NotificationType
    title: str
    message: str
    status: NotificationStatus
    failure_reason: str | None
    attempts: int
    created_at: datetime
    sent_at: datetime | None

    model_config = ConfigDict(from_attributes=True)