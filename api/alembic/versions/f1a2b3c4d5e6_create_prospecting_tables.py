"""create_prospecting_tables

Revision ID: f1a2b3c4d5e6
Revises: d9f1a2b3c4e5
Create Date: 2026-11-10 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'd9f1a2b3c4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'prospecting_campaigns',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('country', sa.String(length=60), nullable=False, server_default='México'),
        sa.Column('state_code', sa.String(length=10), nullable=False, server_default='06'),
        sa.Column('state_name', sa.String(length=80), nullable=False, server_default='Colima'),
        sa.Column('municipality_code', sa.String(length=10), nullable=False, server_default='0'),
        sa.Column('municipality_name', sa.String(length=100), nullable=False, server_default='Todo el estado'),
        sa.Column('scian_codes', sa.String(length=200), nullable=False, server_default='812110'),
        sa.Column('search_keywords', sa.String(length=255), nullable=False, server_default='estetica,barberia,salon de belleza,peluqueria'),
        sa.Column('stratum_filter', sa.String(length=100), nullable=False, server_default='0 a 30 personas'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_run_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_prospecting_campaigns_id'), 'prospecting_campaigns', ['id'], unique=False)

    op.create_table(
        'prospecting_runs',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('prospecting_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('run_type', sa.String(length=30), nullable=False, server_default='discovery'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='running'),
        sa.Column('total_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('new_added', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enriched_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_log', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_prospecting_runs_id'), 'prospecting_runs', ['id'], unique=False)
    op.create_index(op.f('ix_prospecting_runs_campaign_id'), 'prospecting_runs', ['campaign_id'], unique=False)

    op.create_table(
        'prospecting_businesses',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('prospecting_campaigns.id', ondelete='SET NULL'), nullable=True),
        sa.Column('denue_id', sa.String(length=64), nullable=False),
        sa.Column('clee', sa.String(length=80), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('razon_social', sa.String(length=255), nullable=True),
        sa.Column('scian_code', sa.String(length=30), nullable=True),
        sa.Column('scian_activity', sa.String(length=255), nullable=True),
        sa.Column('stratum', sa.String(length=80), nullable=True),
        sa.Column('phone', sa.String(length=60), nullable=True),
        sa.Column('email', sa.String(length=160), nullable=True),
        sa.Column('website_url', sa.String(length=500), nullable=True),
        sa.Column('street', sa.String(length=200), nullable=True),
        sa.Column('ext_number', sa.String(length=40), nullable=True),
        sa.Column('int_number', sa.String(length=40), nullable=True),
        sa.Column('neighborhood', sa.String(length=160), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('locality', sa.String(length=120), nullable=True),
        sa.Column('municipality', sa.String(length=120), nullable=True),
        sa.Column('state', sa.String(length=80), nullable=True),
        sa.Column('latitude', sa.String(length=40), nullable=True),
        sa.Column('longitude', sa.String(length=40), nullable=True),
        sa.Column('status', sa.String(length=40), nullable=False, server_default='pending_enrichment'),
        sa.Column('has_working_website', sa.Boolean(), nullable=True),
        sa.Column('has_ssl', sa.Boolean(), nullable=True),
        sa.Column('has_whatsapp_link', sa.Boolean(), nullable=True),
        sa.Column('has_online_booking', sa.Boolean(), nullable=True),
        sa.Column('booking_provider', sa.String(length=80), nullable=True),
        sa.Column('social_links', sa.JSON(), nullable=True),
        sa.Column('digital_signals', sa.JSON(), nullable=True),
        sa.Column('last_discovered_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_enriched_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_prospecting_businesses_id'), 'prospecting_businesses', ['id'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_campaign_id'), 'prospecting_businesses', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_denue_id'), 'prospecting_businesses', ['denue_id'], unique=True)
    op.create_index(op.f('ix_prospecting_businesses_clee'), 'prospecting_businesses', ['clee'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_scian_activity'), 'prospecting_businesses', ['scian_activity'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_municipality'), 'prospecting_businesses', ['municipality'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_state'), 'prospecting_businesses', ['state'], unique=False)
    op.create_index(op.f('ix_prospecting_businesses_status'), 'prospecting_businesses', ['status'], unique=False)

    op.create_table(
        'prospecting_sources',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('prospecting_businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_type', sa.String(length=40), nullable=False),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('confidence_level', sa.String(length=30), nullable=False, server_default='confirmed'),
        sa.Column('http_status', sa.Integer(), nullable=True),
        sa.Column('summary', sa.String(length=500), nullable=True),
        sa.Column('extracted_data', sa.JSON(), nullable=True),
        sa.Column('fetched_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_prospecting_sources_id'), 'prospecting_sources', ['id'], unique=False)
    op.create_index(op.f('ix_prospecting_sources_business_id'), 'prospecting_sources', ['business_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_prospecting_sources_business_id'), table_name='prospecting_sources')
    op.drop_index(op.f('ix_prospecting_sources_id'), table_name='prospecting_sources')
    op.drop_table('prospecting_sources')

    op.drop_index(op.f('ix_prospecting_businesses_status'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_state'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_municipality'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_scian_activity'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_clee'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_denue_id'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_campaign_id'), table_name='prospecting_businesses')
    op.drop_index(op.f('ix_prospecting_businesses_id'), table_name='prospecting_businesses')
    op.drop_table('prospecting_businesses')

    op.drop_index(op.f('ix_prospecting_runs_campaign_id'), table_name='prospecting_runs')
    op.drop_index(op.f('ix_prospecting_runs_id'), table_name='prospecting_runs')
    op.drop_table('prospecting_runs')

    op.drop_index(op.f('ix_prospecting_campaigns_id'), table_name='prospecting_campaigns')
    op.drop_table('prospecting_campaigns')

