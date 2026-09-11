"""phase 18.7a2 update value check constraint for HOURS

Revision ID: de9ff9501007
Revises: 4badd5b4de83
Create Date: 2026-09-11 22:XX:XX

Swaps the numeric_value CHECK constraint on business_rules to add the
HOURS branch, now that HOURS has been committed to rule_value_type_enum
by the prior migration. Purely additive: existing PERCENTAGE/MINUTES/
INTEGER rows and constraints are unaffected.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'de9ff9501007'
down_revision: Union[str, Sequence[str], None] = '4badd5b4de83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_business_rule_value_matches_type", "business_rules", type_="check")
    op.create_check_constraint(
        "ck_business_rule_value_matches_type",
        "business_rules",
        "(value_type = 'PERCENTAGE' AND numeric_value >= 0 AND numeric_value <= 1) OR "
        "(value_type = 'MINUTES' AND numeric_value >= 0) OR "
        "(value_type = 'INTEGER' AND numeric_value >= 0 AND numeric_value = trunc(numeric_value)) OR "
        "(value_type = 'HOURS' AND numeric_value >= 0)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_business_rule_value_matches_type", "business_rules", type_="check")
    op.create_check_constraint(
        "ck_business_rule_value_matches_type",
        "business_rules",
        "(value_type = 'PERCENTAGE' AND numeric_value >= 0 AND numeric_value <= 1) OR "
        "(value_type = 'MINUTES' AND numeric_value >= 0) OR "
        "(value_type = 'INTEGER' AND numeric_value >= 0 AND numeric_value = trunc(numeric_value))",
    )