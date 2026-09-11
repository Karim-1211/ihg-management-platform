"""phase 18.7a add HOURS rule value type (enum value only)

Revision ID: 4badd5b4de83
Revises: 6e5e4e61be02
Create Date: 2026-09-11 22:24:22.846677

Adds a fourth value (HOURS) to the existing rule_value_type_enum. This is
split into its own migration, separate from the CHECK constraint update,
because PostgreSQL requires a new enum value to be committed in its own
transaction before it can be referenced anywhere else (including a CHECK
constraint) - attempting both in one transaction raises
UnsafeNewEnumValueUsage. No existing rows, columns, or enum values are
altered or removed.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '4badd5b4de83'
down_revision: Union[str, Sequence[str], None] = '6e5e4e61be02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE rule_value_type_enum ADD VALUE 'HOURS'")


def downgrade() -> None:
    # PostgreSQL does not support removing a value from an existing enum
    # type without recreating it entirely. This migration's downgrade is a
    # deliberate no-op; a true reversal would require rebuilding the enum
    # type from scratch, which is out of scope for this additive change.
    pass