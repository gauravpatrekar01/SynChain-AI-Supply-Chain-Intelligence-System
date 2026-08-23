"""Add onboarding state and enterprise integrations.

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.execute("UPDATE users SET onboarding_completed = true")
    op.create_table(
        "enterprise_integrations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("system_type", sa.String(length=50), nullable=False),
        sa.Column("base_url", sa.String(length=2048), nullable=False),
        sa.Column("api_version", sa.String(length=100), nullable=True),
        sa.Column("encrypted_api_key", sa.String(), nullable=False),
        sa.Column("encrypted_api_secret", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_enterprise_integrations_user_id", "enterprise_integrations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_enterprise_integrations_user_id", table_name="enterprise_integrations")
    op.drop_table("enterprise_integrations")
    op.drop_column("users", "onboarding_completed")