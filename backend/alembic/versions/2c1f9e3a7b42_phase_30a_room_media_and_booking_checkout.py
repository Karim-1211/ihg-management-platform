"""Phase 30a: room-specific media and hotel booking checkout.

Revision ID: 2c1f9e3a7b42
Revises: 1a582007e740
"""
from alembic import op
import sqlalchemy as sa

revision = "2c1f9e3a7b42"
down_revision = "1a582007e740"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enums require autocommit for ADD VALUE before the new value
    # can safely be used by the ORM/application.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE media_entity_type_enum ADD VALUE IF NOT EXISTS 'ROOM'")
        op.execute("ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'PAYPAL'")
        op.execute("ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'VISA'")
        op.execute("ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'MASTERCARD'")

    # Guest information is stored as a booking-time snapshot so a later
    # customer profile change does not rewrite historical booking records.
    op.add_column("bookings", sa.Column("guest_name", sa.String(200), nullable=True))
    op.add_column("bookings", sa.Column("guest_email", sa.String(255), nullable=True))
    op.add_column("bookings", sa.Column("guest_phone", sa.String(30), nullable=True))


def downgrade() -> None:
    # PostgreSQL cannot DROP individual enum values cleanly. The enum additions
    # are therefore intentionally not reversed here. Booking snapshot columns
    # are safely removable.
    op.drop_column("bookings", "guest_phone")
    op.drop_column("bookings", "guest_email")
    op.drop_column("bookings", "guest_name")