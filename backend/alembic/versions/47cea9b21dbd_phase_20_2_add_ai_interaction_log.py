"""phase 20.2 add ai_interaction_log

Revision ID: 47cea9b21dbd
Revises: c9e424114838
Create Date: 2026-09-13

Purely additive: one new table for AI interaction audit logging, per the
locked 20.1 architecture. No existing table, column, or enum is touched.
This table is shared across all future AI assistant types (customer/staff/
manager) via the assistant_type column, avoiding a new migration per
sub-phase (20.4, 20.5, etc.).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '47cea9b21dbd'
down_revision: Union[str, Sequence[str], None] = 'c9e424114838'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_interaction_log",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("assistant_type", sa.String(30), nullable=False, server_default="CUSTOMER"),
        sa.Column("prompt_summary", sa.Text(), nullable=False),
        sa.Column("tools_called", sa.Text(), nullable=True),
        sa.Column("token_usage", sa.Integer(), nullable=True),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_interaction_log_user_id", "ai_interaction_log", ["user_id"])
    op.create_index("ix_ai_interaction_log_created_at", "ai_interaction_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_interaction_log_created_at", table_name="ai_interaction_log")
    op.drop_index("ix_ai_interaction_log_user_id", table_name="ai_interaction_log")
    op.drop_table("ai_interaction_log")