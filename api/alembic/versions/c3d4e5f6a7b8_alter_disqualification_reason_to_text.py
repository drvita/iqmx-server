"""alter_disqualification_reason_to_text

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-11 07:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cambiar disqualification_reason de VARCHAR(255) a TEXT para permitir explicaciones detalladas del LLM."""
    op.alter_column(
        'prospecting_businesses',
        'disqualification_reason',
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        'prospecting_businesses',
        'disqualification_reason',
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True
    )
