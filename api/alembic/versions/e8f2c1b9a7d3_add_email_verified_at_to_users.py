"""add_email_verified_at_to_users

Revision ID: e8f2c1b9a7d3
Revises: c7e1f4b2a9d0
Create Date: 2026-09-06 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f2c1b9a7d3'
down_revision: Union[str, Sequence[str], None] = 'c7e1f4b2a9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'email_verified_at')
