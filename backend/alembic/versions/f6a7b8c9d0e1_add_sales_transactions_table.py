"""Add sales_transactions table for sales data ingestion and forecasting

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-16 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sales_transactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('product_id', sa.String(length=100), nullable=False),
        sa.Column('product_name', sa.String(length=255), nullable=False),
        sa.Column('product_category', sa.String(length=255), nullable=False),
        sa.Column('quantity_sold', sa.Integer(), nullable=False),
        sa.Column('unit_selling_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('gross_revenue', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('net_revenue', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=False),
        sa.Column('customer_id', sa.String(length=100), nullable=True),
        sa.Column('order_id', sa.String(length=100), nullable=True),
        sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('return_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='USD'),
        sa.Column('import_id', UUID(as_uuid=True), sa.ForeignKey('data_imports.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_sales_transactions_transaction_id', 'sales_transactions', ['transaction_id'], unique=True)
    op.create_index('ix_sales_transactions_transaction_date', 'sales_transactions', ['transaction_date'])
    op.create_index('ix_sales_transactions_product_id', 'sales_transactions', ['product_id'])
    op.create_index('ix_sales_transactions_product_category', 'sales_transactions', ['product_category'])
    op.create_index('ix_sales_transactions_region', 'sales_transactions', ['region'])
    op.create_index('ix_sales_transactions_customer_id', 'sales_transactions', ['customer_id'])
    op.create_index('ix_sales_transactions_order_id', 'sales_transactions', ['order_id'])
    op.create_index('ix_sales_transactions_import_id', 'sales_transactions', ['import_id'])


def downgrade() -> None:
    op.drop_index('ix_sales_transactions_import_id', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_order_id', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_customer_id', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_region', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_product_category', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_product_id', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_transaction_date', table_name='sales_transactions')
    op.drop_index('ix_sales_transactions_transaction_id', table_name='sales_transactions')
    op.drop_table('sales_transactions')
