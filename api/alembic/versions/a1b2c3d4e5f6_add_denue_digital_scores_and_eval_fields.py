"""add_denue_digital_scores_and_eval_fields

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-11-10 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Agregar scores bimodales, campo canal prioritario y campos de evaluación LLM."""
    op.add_column('prospecting_businesses', sa.Column('denue_score', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('prospecting_businesses', sa.Column('digital_score', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('prospecting_businesses', sa.Column('disqualification_reason', sa.String(length=255), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('contact_channel', sa.String(length=40), nullable=True, server_default='none'))
    op.add_column('prospecting_businesses', sa.Column('llm_analysis', sa.JSON(), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('last_scraped_at', sa.DateTime(), nullable=True))
    op.add_column('prospecting_businesses', sa.Column('last_evaluated_at', sa.DateTime(), nullable=True))

    op.create_index(op.f('ix_prospecting_businesses_denue_score'), 'prospecting_businesses', ['denue_score'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_digital_score'), 'prospecting_businesses', ['digital_score'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_contact_channel'), 'prospecting_businesses', ['contact_channel'], unique=False)

    # Actualizar estado por defecto a 'discovered' y calcular denue_score inicial para los 744 registros existentes
    op.execute("""
        UPDATE prospecting_businesses
        SET 
            status = 'discovered',
            denue_score = (
                (CASE WHEN phone IS NOT NULL AND TRIM(phone) != '' THEN 25 ELSE 0 END) +
                (CASE WHEN email IS NOT NULL AND TRIM(email) != '' THEN 15 ELSE 0 END) +
                (CASE WHEN street IS NOT NULL AND TRIM(street) != '' THEN 5 ELSE 0 END) +
                (CASE WHEN latitude IS NOT NULL AND TRIM(latitude) != '' AND longitude IS NOT NULL AND TRIM(longitude) != '' THEN 5 ELSE 0 END)
            )
        WHERE denue_score = 0;
    """)


def downgrade() -> None:
    """Revertir cambios."""
    op.drop_index(op.f('ix_prospecting_businesses_contact_channel'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_digital_score'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_denue_score'), table_name='prospecting_businesses')

    op.drop_column('prospecting_businesses', 'last_evaluated_at')
    op.drop_column('prospecting_businesses', 'last_scraped_at')
    op.drop_column('prospecting_businesses', 'llm_analysis')
    op.drop_column('prospecting_businesses', 'contact_channel')
    op.drop_column('prospecting_businesses', 'disqualification_reason')
    op.drop_column('prospecting_businesses', 'digital_score')
    op.drop_column('prospecting_businesses', 'denue_score')
