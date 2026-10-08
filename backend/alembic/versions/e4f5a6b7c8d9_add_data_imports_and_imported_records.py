"""Add data_imports and imported_records tables

Revision ID: e4f5a6b7c8d9
Revises: 8fd2e81ac729
Create Date: 2026-10-08 12:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, Sequence[str], None] = '8fd2e81ac729'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'data_imports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('source_type', sa.String(length=50), server_default='file', nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='pending', nullable=False),
        sa.Column('rows_total', sa.Integer(), server_default='0', nullable=False),
        sa.Column('rows_processed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('rows_failed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('columns_detected', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('column_mapping', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_data_imports_user_id', 'data_imports', ['user_id'])

    op.create_table(
        'imported_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('import_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('source_file', sa.String(length=255), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False),
        sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('normalized_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('target_entity_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='imported', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['import_id'], ['data_imports.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_imported_records_import_id', 'imported_records', ['import_id'])


def downgrade() -> None:
    op.drop_index('ix_imported_records_import_id', table_name='imported_records')
    op.drop_table('imported_records')
    op.drop_index('ix_data_imports_user_id', table_name='data_imports')
    op.drop_table('data_imports')
