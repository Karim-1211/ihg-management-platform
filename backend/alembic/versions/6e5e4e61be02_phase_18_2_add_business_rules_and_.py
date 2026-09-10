"""phase 18.2: add business_rules and business_rule_history

Revision ID: 6e5e4e61be02
Revises: 1cb8c17c7496
Create Date: 2026-09-09 23:52:44.513838

This migration is purely additive — two new tables, three new enum types.
It does not rename, alter, or touch any existing table, column, or enum
from Phases 1-17. No data is inserted by this migration; Category A rule
rows will be created by a separate, explicitly-approved backfill step.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '6e5e4e61be02'
down_revision: Union[str, Sequence[str], None] = '1cb8c17c7496'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New enum types for the rule engine.
    rule_scope_type_enum = postgresql.ENUM("GLOBAL", "HOTEL", "RESTAURANT", name="rule_scope_type_enum")
    rule_scope_type_enum.create(op.get_bind())

    rule_value_type_enum = postgresql.ENUM("PERCENTAGE", "MINUTES", "INTEGER", name="rule_value_type_enum")
    rule_value_type_enum.create(op.get_bind())

    rule_status_enum = postgresql.ENUM("ACTIVE", "INACTIVE", name="rule_status_enum")
    rule_status_enum.create(op.get_bind())

    # 2. business_rules — created first, since business_rule_history FKs into it.
    op.create_table(
        "business_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("rule_key", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "scope_type",
            postgresql.ENUM("GLOBAL", "HOTEL", "RESTAURANT", name="rule_scope_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("hotel_id", sa.UUID(), nullable=True),
        sa.Column("restaurant_id", sa.UUID(), nullable=True),
        sa.Column(
            "value_type",
            postgresql.ENUM("PERCENTAGE", "MINUTES", "INTEGER", name="rule_value_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("numeric_value", sa.Numeric(10, 4), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM("ACTIVE", "INACTIVE", name="rule_status_enum", create_type=False),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column("effective_from", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint(
            "(scope_type = 'GLOBAL' AND hotel_id IS NULL AND restaurant_id IS NULL) OR "
            "(scope_type = 'HOTEL' AND hotel_id IS NOT NULL AND restaurant_id IS NULL) OR "
            "(scope_type = 'RESTAURANT' AND hotel_id IS NULL AND restaurant_id IS NOT NULL)",
            name="ck_business_rule_scope_matches_reference",
        ),
        sa.CheckConstraint("effective_until IS NULL OR effective_until > effective_from", name="ck_business_rule_effective_window_valid"),
        sa.CheckConstraint("priority >= 0", name="ck_business_rule_priority_nonnegative"),
        sa.CheckConstraint(
            "(value_type = 'PERCENTAGE' AND numeric_value >= 0 AND numeric_value <= 1) OR "
            "(value_type = 'MINUTES' AND numeric_value >= 0) OR "
            "(value_type = 'INTEGER' AND numeric_value >= 0 AND numeric_value = trunc(numeric_value))",
            name="ck_business_rule_value_matches_type",
        ),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_business_rule_resolution",
        "business_rules",
        ["rule_key", "scope_type", "hotel_id", "restaurant_id", "status", "effective_from", "effective_until"],
    )

    # 3. business_rule_history — reuses rule_status_enum (no new enum for status here).
    op.create_table(
        "business_rule_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_rule_id", sa.UUID(), nullable=False),
        sa.Column("changed_by", sa.UUID(), nullable=True),
        sa.Column("change_type", sa.String(30), nullable=False),
        sa.Column("previous_numeric_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("new_numeric_value", sa.Numeric(10, 4), nullable=True),
        sa.Column(
            "previous_status",
            postgresql.ENUM("ACTIVE", "INACTIVE", name="rule_status_enum", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "new_status",
            postgresql.ENUM("ACTIVE", "INACTIVE", name="rule_status_enum", create_type=False),
            nullable=True,
        ),
        sa.Column("previous_priority", sa.Integer(), nullable=True),
        sa.Column("new_priority", sa.Integer(), nullable=True),
        sa.Column("previous_effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("new_effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("previous_effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("new_effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["business_rule_id"], ["business_rules.id"]),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("business_rule_history")
    op.drop_index("ix_business_rule_resolution", table_name="business_rules")
    op.drop_table("business_rules")
    op.execute("DROP TYPE rule_status_enum")
    op.execute("DROP TYPE rule_value_type_enum")
    op.execute("DROP TYPE rule_scope_type_enum")