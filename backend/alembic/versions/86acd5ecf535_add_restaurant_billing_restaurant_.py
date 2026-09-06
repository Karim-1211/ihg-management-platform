"""add restaurant billing: restaurant_invoices, restaurant_payments

Revision ID: 86acd5ecf535
Revises: bc1e21766263
Create Date: 2026-09-03 23:24:32.855398
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '86acd5ecf535'
down_revision: Union[str, Sequence[str], None] = 'bc1e21766263'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    invoice_status_enum = postgresql.ENUM('UNPAID', 'PAID', name='invoice_status_enum', create_type=False)
    payment_method_enum = postgresql.ENUM('CASH', 'CARD', 'MOBILE_PAYMENT', 'DEMO', name='payment_method_enum', create_type=False)
    payment_status_enum = postgresql.ENUM('PENDING', 'SUCCESS', 'FAILED', name='payment_status_enum', create_type=False)

    op.create_table('restaurant_invoices',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('invoice_number', sa.String(length=20), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('restaurant_id', sa.UUID(), nullable=False),
    sa.Column('customer_id', sa.UUID(), nullable=True),
    sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('status', invoice_status_enum, nullable=False),
    sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['restaurant_id'], ['restaurants.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    op.create_index(op.f('ix_restaurant_invoices_invoice_number'), 'restaurant_invoices', ['invoice_number'], unique=True)
    op.create_table('restaurant_payments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('invoice_id', sa.UUID(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('payment_method', payment_method_enum, nullable=False),
    sa.Column('status', payment_status_enum, nullable=False),
    sa.Column('transaction_reference', sa.String(length=50), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['invoice_id'], ['restaurant_invoices.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_table('restaurant_payments')
    op.drop_index(op.f('ix_restaurant_invoices_invoice_number'), table_name='restaurant_invoices')
    op.drop_table('restaurant_invoices')
    # ### end Alembic commands ###