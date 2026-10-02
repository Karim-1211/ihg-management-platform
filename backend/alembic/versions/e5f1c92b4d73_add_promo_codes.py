"""add promo codes and redemptions

Revision ID: e5f1c92b4d73
Revises: d3a7b81f6c24
Create Date: 2026-09-24

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e5f1c92b4d73"
down_revision = "d3a7b81f6c24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Create the type explicitly, then reference it with create_type=False.
    # Without that flag SQLAlchemy tries to create it a SECOND time while
    # building the table, which fails with "type already exists" and leaves
    # the migration half-applied.
    promo_scope = postgresql.ENUM(
        "ANY", "HOTEL", "RESTAURANT", "DELIVERY",
        name="promo_scope_enum",
        create_type=False,
    )
    promo_scope.create(bind, checkfirst=True)

    op.create_table(
        "promo_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("percent_off", sa.Numeric(5, 4), nullable=False),
        sa.Column("scope", promo_scope, nullable=False, server_default="ANY"),
        sa.Column("issued_to_email", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("max_redemptions", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("times_redeemed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("percent_off > 0 AND percent_off <= 1", name="ck_promo_percent_range"),
        sa.CheckConstraint("times_redeemed >= 0", name="ck_promo_redeemed_nonnegative"),
        sa.CheckConstraint("max_redemptions >= 1", name="ck_promo_max_redemptions_positive"),
    )
    op.create_unique_constraint("uq_promo_codes_code", "promo_codes", ["code"])
    op.create_index("ix_promo_codes_code", "promo_codes", ["code"])
    op.create_index("ix_promo_codes_issued_to_email", "promo_codes", ["issued_to_email"])

    op.create_table(
        "promo_redemptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("promo_code_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("promo_codes.id"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("amount_discounted", sa.Numeric(10, 2), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_promo_redemptions_promo_code_id", "promo_redemptions", ["promo_code_id"])


def downgrade() -> None:
    op.drop_index("ix_promo_redemptions_promo_code_id", table_name="promo_redemptions")
    op.drop_table("promo_redemptions")
    op.drop_index("ix_promo_codes_issued_to_email", table_name="promo_codes")
    op.drop_index("ix_promo_codes_code", table_name="promo_codes")
    op.drop_constraint("uq_promo_codes_code", "promo_codes", type_="unique")
    op.drop_table("promo_codes")
    postgresql.ENUM(name="promo_scope_enum").drop(op.get_bind(), checkfirst=True)