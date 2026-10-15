"""Add extended fields to inventory table

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-10-15 04:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inventory', sa.Column('lead_time_days', sa.Integer(), nullable=True))
    op.add_column('inventory', sa.Column('average_daily_demand', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('inventory', 'average_daily_demand')
    op.drop_column('inventory', 'lead_time_days')
