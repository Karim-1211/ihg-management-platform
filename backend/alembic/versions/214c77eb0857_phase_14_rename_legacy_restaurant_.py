"""phase 14 rename legacy restaurant billing tables

Revision ID: 214c77eb0857
Revises: a447a50726b6
Create Date: 2026-09-06 14:11:24.555609

IMPORTANT — OPERATIONAL BOUNDARY:
Same hard-cutover discipline as Migration A. Sequence: (1) stop the running
backend, (2) run this migration, (3) verify schema in pgAdmin, (4) run the
Restaurant/Delivery backfill script, (5) review its reconciliation report,
(6) only then deploy the updated restaurant_billing_service.py code,
(7) run test_restaurant_billing.ps1 and test_delivery.ps1, (8) run full
three-way regression (Hotel + Restaurant + Delivery together), (9) only
after all pass, schedule a later cleanup migration to drop *_legacy tables.

This migration does NOT touch the unified invoices/payments tables at all —
those already exist from Migration A and require no schema changes.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '214c77eb0857'
down_revision: Union[str, Sequence[str], None] = 'a447a50726b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Preserve all existing Restaurant/Delivery billing data by renaming,
    # not dropping. No other schema changes in this migration.
    op.rename_table("restaurant_invoices", "restaurant_invoices_legacy")
    op.rename_table("restaurant_payments", "restaurant_payments_legacy")


def downgrade() -> None:
    op.rename_table("restaurant_payments_legacy", "restaurant_payments")
    op.rename_table("restaurant_invoices_legacy", "restaurant_invoices")