"""phase 18.7b add service_charge_amount to orders

Revision ID: cfaa867cda7c
Revises: de9ff9501007
Create Date: 2026-09-11 23:56:14.426213

Purely additive: one nullable-with-default NUMERIC column on orders,
matching the existing tax_amount/discount_amount pattern exactly. Existing
rows get 0.00 (correct - no order created before this migration had a
service charge). No other column, table, or enum is touched.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'cfaa867cda7c'
down_revision: Union[str, Sequence[str], None] = 'de9ff9501007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("service_charge_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("orders", "service_charge_amount")