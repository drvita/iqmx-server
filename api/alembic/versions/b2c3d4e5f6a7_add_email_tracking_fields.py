"""add_email_tracking_fields_to_prospecting_businesses

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-10 21:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar campos de rastreo de email para evitar duplicados y registrar entregas / aperturas de Mailtrap."""
    op.add_column('prospecting_businesses', sa.Column('email_sent_at', sa.DateTime(), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('email_message_id', sa.String(length=120), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('email_delivery_status', sa.String(length=40), nullable=True, server_default='none'))
    op.add_column('prospecting_businesses', sa.Column('email_delivered_at', sa.DateTime(), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('email_opened_at', sa.DateTime(), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('email_clicked_at', sa.DateTime(), nullable=True))

    op.create_index(op.f('ix_prospecting_businesses_email_message_id'), 'prospecting_businesses', ['email_message_id'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_email_delivery_status'), 'prospecting_businesses', ['email_delivery_status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_prospecting_businesses_email_delivery_status'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_email_message_id'), table_name='prospecting_businesses')
    op.drop_column('prospecting_businesses', 'email_clicked_at')
    op.drop_column('prospecting_businesses', 'email_opened_at')
    op.drop_column('prospecting_businesses', 'email_delivered_at')
    op.drop_column('prospecting_businesses', 'email_delivery_status')
    op.drop_column('prospecting_businesses', 'email_message_id')
    op.drop_column('prospecting_businesses', 'email_sent_at')
