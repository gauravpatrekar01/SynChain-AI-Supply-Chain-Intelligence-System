"""Add extended fields to suppliers table

Revision ID: d3e4f5a6b7c8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-15 01:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('suppliers', sa.Column('supplier_code', sa.String(length=100), nullable=True))
    op.add_column('suppliers', sa.Column('location', sa.String(length=255), nullable=True))
    op.add_column('suppliers', sa.Column('contact_person', sa.String(length=255), nullable=True))
    op.add_column('suppliers', sa.Column('email', sa.String(length=255), nullable=True))
    op.add_column('suppliers', sa.Column('phone', sa.String(length=100), nullable=True))
    op.add_column('suppliers', sa.Column('quality_rating', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('suppliers', sa.Column('lead_time_days', sa.Integer(), nullable=True))
    op.add_column('suppliers', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column('suppliers', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

    op.create_unique_constraint('uq_suppliers_supplier_code', 'suppliers', ['supplier_code'])
    op.create_index('ix_suppliers_supplier_code', 'suppliers', ['supplier_code'])


def downgrade() -> None:
    op.drop_index('ix_suppliers_supplier_code', table_name='suppliers')
    op.drop_constraint('uq_suppliers_supplier_code', 'suppliers', type_='unique')
    op.drop_column('suppliers', 'is_active')
    op.drop_column('suppliers', 'capacity')
    op.drop_column('suppliers', 'lead_time_days')
    op.drop_column('suppliers', 'quality_rating')
    op.drop_column('suppliers', 'phone')
    op.drop_column('suppliers', 'email')
    op.drop_column('suppliers', 'contact_person')
    op.drop_column('suppliers', 'location')
    op.drop_column('suppliers', 'supplier_code')
