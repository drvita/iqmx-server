"""add_telegram_chat_id_to_users

Revision ID: c7e1f4b2a9d0
Revises: 8b959bb2b705
Create Date: 2026-09-06 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e1f4b2a9d0'
down_revision: Union[str, Sequence[str], None] = '8b959bb2b705'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('telegram_chat_id', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_users_telegram_chat_id'), 'users', ['telegram_chat_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_telegram_chat_id'), table_name='users')
    op.drop_column('users', 'telegram_chat_id')
