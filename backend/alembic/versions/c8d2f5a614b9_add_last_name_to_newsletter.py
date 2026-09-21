"""add last_name to newsletter_subscribers

Revision ID: c8d2f5a614b9
Revises: b4e1a9c73d52
Create Date: 2026-09-20

Existing rows keep whatever full name was captured in first_name; only
new subscriptions are split into first/last.
"""
import sqlalchemy as sa
from alembic import op

revision = "c8d2f5a614b9"
down_revision = "b4e1a9c73d52"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("newsletter_subscribers", sa.Column("last_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("newsletter_subscribers", "last_name")