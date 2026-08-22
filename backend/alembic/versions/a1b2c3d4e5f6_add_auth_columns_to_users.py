"""Add auth columns to users and create auth token tables

Revision ID: a1b2c3d4e5f6
Revises: 8f2d125a59a5
Create Date: 2026-08-23 00:03:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '8f2d125a59a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing auth columns to users table and create auth token tables."""

    # Add missing auth columns to existing users table
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')))
    op.add_column('users', sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))

    # After adding with server_default, make the columns not-null where needed
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    op.execute("UPDATE users SET is_verified = false WHERE is_verified IS NULL")
    op.execute("UPDATE users SET is_active = true WHERE is_active IS NULL")

    op.alter_column('users', 'password_hash', nullable=False)
    op.alter_column('users', 'is_verified', nullable=False)
    op.alter_column('users', 'is_active', nullable=False)

    # Create email_verification_tokens table
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_email_verification_tokens_token_hash'),
        'email_verification_tokens', ['token_hash'], unique=True
    )

    # Create password_reset_tokens table
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(
        op.f('ix_password_reset_tokens_token_hash'),
        'password_reset_tokens', ['token_hash'], unique=True
    )


def downgrade() -> None:
    """Revert auth schema changes."""
    op.drop_index(op.f('ix_password_reset_tokens_token_hash'), table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')

    op.drop_index(op.f('ix_email_verification_tokens_token_hash'), table_name='email_verification_tokens')
    op.drop_table('email_verification_tokens')

    op.drop_column('users', 'last_login')
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'is_verified')
    op.drop_column('users', 'password_hash')
