"""phase 20.2 add ai_interaction_log

Revision ID: c9e424114838
Revises: cfaa867cda7c
Create Date: 2026-09-12 22:51:27.416296
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9e424114838'
down_revision: Union[str, Sequence[str], None] = 'cfaa867cda7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
