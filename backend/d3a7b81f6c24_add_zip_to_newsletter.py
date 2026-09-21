"""add zip_code to newsletter_subscribers

Revision ID: d3a7b81f6c24
Revises: c8d2f5a614b9
Create Date: 2026-09-20
"""
import sqlalchemy as sa
from alembic import op

revision = "d3a7b81f6c24"
down_revision = "c8d2f5a614b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("newsletter_subscribers", sa.Column("zip_code", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("newsletter_subscribers", "zip_code")