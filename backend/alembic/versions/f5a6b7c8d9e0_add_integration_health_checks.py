"""Add integration_health_checks table

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-10-12 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, Sequence[str], None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'integration_health_checks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('integration_name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('latency_ms', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False),
        sa.Column('error_category', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_integration_health_checks_integration_name', 'integration_health_checks', ['integration_name'])
    op.create_index('ix_integration_health_checks_checked_at', 'integration_health_checks', ['checked_at'])


def downgrade() -> None:
    op.drop_index('ix_integration_health_checks_checked_at', table_name='integration_health_checks')
    op.drop_index('ix_integration_health_checks_integration_name', table_name='integration_health_checks')
    op.drop_table('integration_health_checks')
