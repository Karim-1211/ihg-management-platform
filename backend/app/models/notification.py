import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    String, Text, Integer, ForeignKey, DateTime, Enum as SQLEnum, UniqueConstraint, Boolean, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class NotificationType(str, enum.Enum):
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    CHECK_IN_COMPLETED = "CHECK_IN_COMPLETED"
    CHECK_OUT_COMPLETED = "CHECK_OUT_COMPLETED"
    SERVICE_REQUEST_CREATED = "SERVICE_REQUEST_CREATED"
    SERVICE_REQUEST_COMPLETED = "SERVICE_REQUEST_COMPLETED"
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_READY = "ORDER_READY"
    ORDER_SERVED = "ORDER_SERVED"
    DELIVERY_ASSIGNED = "DELIVERY_ASSIGNED"
    DELIVERY_OUT_FOR_DELIVERY = "DELIVERY_OUT_FOR_DELIVERY"
    DELIVERY_DELIVERED = "DELIVERY_DELIVERED"
    INVOICE_CREATED = "INVOICE_CREATED"
    PAYMENT_COMPLETED = "PAYMENT_COMPLETED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    LOW_STOCK_ALERT = "LOW_STOCK_ALERT"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class NotificationStatus(str, enum.Enum):
    # IN_APP: SENT = persisted and visible to the recipient. READ = recipient viewed it.
    # EMAIL: PENDING -> SENT (provider accepted) or FAILED (exhausted attempts).
    PENDING = "PENDING"
    SENT = "SENT"
    READ = "READ"
    FAILED = "FAILED"


class NotificationPriority(str, enum.Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("event_id", "recipient_user_id", "channel", name="uq_notification_event_recipient_channel"),
        Index("ix_notifications_recipient_status", "recipient_user_id", "status"),
        Index("ix_notifications_recipient_created", "recipient_user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notification_type_enum"), nullable=False
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        SQLEnum(NotificationChannel, name="notification_channel_enum"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[NotificationPriority] = mapped_column(
        SQLEnum(NotificationPriority, name="notification_priority_enum"), nullable=False, default=NotificationPriority.NORMAL
    )
    status: Mapped[NotificationStatus] = mapped_column(
        SQLEnum(NotificationStatus, name="notification_status_enum"), nullable=False, default=NotificationStatus.PENDING
    )
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    hotel_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "notification_type", name="uq_notification_preference_user_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType, name="notification_type_enum"), nullable=False
    )
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)