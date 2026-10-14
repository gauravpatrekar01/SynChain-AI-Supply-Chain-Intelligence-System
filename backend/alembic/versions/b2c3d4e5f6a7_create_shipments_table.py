"""create shipments table

Revision ID: b2c3d4e5f6a7
Revises: ab12cd34ef56
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'ab12cd34ef56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'shipments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('shipment_id', sa.String(length=100), nullable=False),
        sa.Column('shipment_name', sa.String(length=255), nullable=False),
        sa.Column('supplier_id', sa.UUID(), nullable=True),
        sa.Column('origin', sa.String(length=255), nullable=False),
        sa.Column('destination', sa.String(length=255), nullable=False),
        sa.Column('cargo_description', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('transport_mode', sa.String(length=50), nullable=False),
        sa.Column('departure_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expected_delivery_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('carrier_name', sa.String(length=255), nullable=False),
        sa.Column('tracking_number', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='in_transit', nullable=False),
        sa.Column('risk_score', sa.Integer(), server_default='0', nullable=False),
        sa.Column('risk_level', sa.String(length=50), server_default='LOW', nullable=False),
        sa.Column('risk_factors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('data_completeness', sa.String(length=50), server_default='PARTIAL', nullable=False),
        sa.Column('initial_risk_score', sa.Integer(), nullable=True),
        sa.Column('tracking_history', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shipment_id')
    )
    op.create_index('ix_shipments_shipment_id', 'shipments', ['shipment_id'])
    op.create_index('ix_shipments_supplier_id', 'shipments', ['supplier_id'])


def downgrade() -> None:
    op.drop_index('ix_shipments_supplier_id', table_name='shipments')
    op.drop_index('ix_shipments_shipment_id', table_name='shipments')
    op.drop_table('shipments')
