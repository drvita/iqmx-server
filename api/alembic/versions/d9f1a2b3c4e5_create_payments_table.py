"""create_payments_table

Revision ID: d9f1a2b3c4e5
Revises: e8f2c1b9a7d3
Create Date: 2026-09-06 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9f1a2b3c4e5'
down_revision: Union[str, Sequence[str], None] = 'e8f2c1b9a7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subscription_id', sa.Integer(), sa.ForeignKey('customer_subscriptions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('mp_payment_id', sa.String(length=100), nullable=True),
        sa.Column('mp_authorized_payment_id', sa.String(length=100), nullable=True),
        sa.Column('mp_preapproval_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='approved'),
        sa.Column('status_detail', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='MXN'),
        sa.Column('payment_method_id', sa.String(length=50), nullable=True),
        sa.Column('payment_type_id', sa.String(length=50), nullable=True),
        sa.Column('card_last_four', sa.String(length=4), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_payments_id'), 'payments', ['id'], unique=False)
    op.create_index(op.f('ix_payments_customer_id'), 'payments', ['customer_id'], unique=False)
    op.create_index(op.f('ix_payments_subscription_id'), 'payments', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_payments_mp_payment_id'), 'payments', ['mp_payment_id'], unique=True)
    op.create_index(op.f('ix_payments_mp_authorized_payment_id'), 'payments', ['mp_authorized_payment_id'], unique=False)
    op.create_index(op.f('ix_payments_mp_preapproval_id'), 'payments', ['mp_preapproval_id'], unique=False)
    op.create_index(op.f('ix_payments_status'), 'payments', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_payments_status'), table_name='payments')
    op.drop_index(op.f('ix_payments_mp_preapproval_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_mp_authorized_payment_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_mp_payment_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_subscription_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_customer_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_id'), table_name='payments')
    op.drop_table('payments')
