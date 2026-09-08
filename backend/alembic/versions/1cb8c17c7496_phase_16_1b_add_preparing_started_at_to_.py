"""phase 16.1b add preparing_started_at to orders

Revision ID: 1cb8c17c7496
Revises: 47a10511e89a
Create Date: 2026-09-09 00:40:09.952344

Purely additive: one nullable timestamp column on orders, no backfill,
no data risk. Existing orders get NULL, meaning "unknown" - explicitly
excluded from Kitchen Bottleneck calculations rather than assumed.

This column is deliberately separate from orders.updated_at, which is
bumped by unrelated changes (e.g. assign_waiter) and would silently
corrupt a "how long has this order been preparing" calculation.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '1cb8c17c7496'
down_revision: Union[str, Sequence[str], None] = '47a10511e89a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("preparing_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "preparing_started_at")