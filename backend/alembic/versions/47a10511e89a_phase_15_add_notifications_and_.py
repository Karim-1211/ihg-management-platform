"""phase 15: add notifications and notification_preferences

Revision ID: 47a10511e89a
Revises: 214c77eb0857
Create Date: 2026-09-07 01:08:50.979330

This migration is purely additive — two new tables, four new enum types.
It does not rename, alter, or touch any existing table, column, or enum
from Phases 1-14 (including invoices/payments from Phase 14).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '47a10511e89a'
down_revision: Union[str, Sequence[str], None] = '214c77eb0857'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notification_type_enum = postgresql.ENUM(
        "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "CHECK_IN_COMPLETED", "CHECK_OUT_COMPLETED",
        "SERVICE_REQUEST_CREATED", "SERVICE_REQUEST_COMPLETED",
        "ORDER_CREATED", "ORDER_READY", "ORDER_SERVED",
        "DELIVERY_ASSIGNED", "DELIVERY_OUT_FOR_DELIVERY", "DELIVERY_DELIVERED",
        "INVOICE_CREATED", "PAYMENT_COMPLETED", "PAYMENT_FAILED",
        "LOW_STOCK_ALERT",
        name="notification_type_enum",
    )
    notification_type_enum.create(op.get_bind())

    notification_channel_enum = postgresql.ENUM("IN_APP", "EMAIL", name="notification_channel_enum")
    notification_channel_enum.create(op.get_bind())

    notification_status_enum = postgresql.ENUM("PENDING", "SENT", "READ", "FAILED", name="notification_status_enum")
    notification_status_enum.create(op.get_bind())

    notification_priority_enum = postgresql.ENUM("LOW", "NORMAL", "HIGH", "URGENT", name="notification_priority_enum")
    notification_priority_enum.create(op.get_bind())

    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("recipient_user_id", sa.UUID(), nullable=False),
        sa.Column(
            "notification_type",
            postgresql.ENUM(name="notification_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "channel",
            postgresql.ENUM(name="notification_channel_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "priority",
            postgresql.ENUM(name="notification_priority_enum", create_type=False),
            nullable=False,
            server_default="NORMAL",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="notification_status_enum", create_type=False),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("related_entity_type", sa.String(50), nullable=True),
        sa.Column("related_entity_id", sa.UUID(), nullable=True),
        sa.Column("hotel_id", sa.UUID(), nullable=True),
        sa.Column("restaurant_id", sa.UUID(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "recipient_user_id", "channel", name="uq_notification_event_recipient_channel"),
    )
    op.create_index("ix_notifications_recipient_status", "notifications", ["recipient_user_id", "status"])
    op.create_index("ix_notifications_recipient_created", "notifications", ["recipient_user_id", "created_at"])

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "notification_type",
            postgresql.ENUM(name="notification_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "notification_type", name="uq_notification_preference_user_type"),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_index("ix_notifications_recipient_created", table_name="notifications")
    op.drop_index("ix_notifications_recipient_status", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE notification_priority_enum")
    op.execute("DROP TYPE notification_status_enum")
    op.execute("DROP TYPE notification_channel_enum")
    op.execute("DROP TYPE notification_type_enum")