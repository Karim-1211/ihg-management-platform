"""phase 14: unified invoices and payments

Revision ID: a447a50726b6
Revises: 81f1df8bcda1
Create Date: 2026-09-06 00:36:49.637829

IMPORTANT — OPERATIONAL BOUNDARY:
This migration is a hard cutover point, not an incremental change to a live app.
Sequence must be: (1) stop the running backend, (2) run this migration,
(3) verify schema manually in pgAdmin, (4) run the separate backfill script,
(5) review the reconciliation report it prints, (6) only then deploy the
updated billing_service.py code, (7) run Hotel + Restaurant + Delivery
regression scripts, (8) only after all pass, schedule a later cleanup
migration to drop the *_legacy tables.

NOTE ON DOWNGRADE: Postgres has no DROP VALUE for enums. The RENAME VALUE
'SUCCESS'->'COMPLETED' and the added enum values (PROCESSING, CANCELLED,
REFUNDED, PARTIALLY_PAID) are NOT reversed by downgrade() below — a true
rollback would require rebuilding the enum types from scratch. This is a
known, accepted limitation, not an oversight.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a447a50726b6'
down_revision: Union[str, Sequence[str], None] = '81f1df8bcda1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Preserve legacy Hotel billing data by renaming, not dropping.
    op.rename_table("invoices", "invoices_legacy")
    op.rename_table("payments", "payments_legacy")

    # 2. New discriminator enum for invoice domain.
    invoice_type_enum = postgresql.ENUM("HOTEL", "RESTAURANT", name="invoice_type_enum")
    invoice_type_enum.create(op.get_bind())

    # 3. Enum transitions — must run outside this migration's transaction block.
    #    Verified against actual DB contents before writing this: payment_status_enum
    #    was PENDING/SUCCESS/FAILED, invoice_status_enum was UNPAID/PAID.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE payment_status_enum RENAME VALUE 'SUCCESS' TO 'COMPLETED'")
        op.execute("ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'PROCESSING'")
        op.execute("ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED'")
        op.execute("ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'REFUNDED'")
        op.execute("ALTER TYPE invoice_status_enum ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID'")

    # 4. New unified invoices table.
    op.create_table(
        "invoices",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("invoice_number", sa.String(20), nullable=False, unique=True),
        sa.Column(
            "invoice_type",
            postgresql.ENUM("HOTEL", "RESTAURANT", name="invoice_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("booking_id", sa.UUID(), nullable=True),
        sa.Column("order_id", sa.UUID(), nullable=True),
        sa.Column("restaurant_id", sa.UUID(), nullable=True),
        sa.Column("customer_id", sa.UUID(), nullable=True),
        sa.Column("room_charge", sa.Numeric(10, 2), nullable=True),
        sa.Column("service_charge", sa.Numeric(10, 2), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM("UNPAID", "PARTIALLY_PAID", "PAID", name="invoice_status_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "(invoice_type = 'HOTEL' AND booking_id IS NOT NULL AND order_id IS NULL AND restaurant_id IS NULL) OR "
            "(invoice_type = 'RESTAURANT' AND order_id IS NOT NULL AND booking_id IS NULL AND restaurant_id IS NOT NULL)",
            name="ck_invoice_type_matches_reference",
        ),
        sa.CheckConstraint("total_amount >= 0", name="ck_invoice_total_nonnegative"),
        sa.CheckConstraint("amount_paid >= 0", name="ck_invoice_amount_paid_nonnegative"),
        sa.CheckConstraint("amount_paid <= total_amount", name="ck_invoice_amount_paid_not_exceed_total"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_id", name="uq_invoice_booking_id"),
        sa.UniqueConstraint("order_id", name="uq_invoice_order_id"),
    )

    # 5. New unified payments table.
    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("payment_number", sa.String(20), nullable=False, unique=True),
        sa.Column("invoice_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "method",
            postgresql.ENUM("CASH", "CARD", "MOBILE_PAYMENT", "DEMO", name="payment_method_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED",
                name="payment_status_enum", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("provider", sa.String(30), nullable=False, server_default="DEMO"),
        sa.Column("provider_reference", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_payments_provider_reference",
        "payments",
        ["provider", "provider_reference"],
        unique=True,
        postgresql_where=sa.text("provider_reference IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_payments_provider_reference", table_name="payments")
    op.drop_table("payments")
    op.drop_table("invoices")
    op.execute("DROP TYPE invoice_type_enum")
    op.rename_table("payments_legacy", "payments")
    op.rename_table("invoices_legacy", "invoices")
    # Enum value additions/rename are intentionally NOT reversed — see note above.