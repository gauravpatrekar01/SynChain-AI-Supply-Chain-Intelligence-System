"""Atomic imports, daily observations and explicit buffer inputs.

Existing duplicate inventory routes must be reconciled before upgrading; this
migration deliberately does not choose which business record to delete.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "ab12cd34ef56"
down_revision = "f5a6b7c8d9e0"
branch_labels = depends_on = None


def upgrade():
    op.add_column("data_imports", sa.Column("import_mode", sa.String(20), nullable=False, server_default="append"))
    op.add_column("data_imports", sa.Column("validation_token", sa.String(64)))
    op.add_column("data_imports", sa.Column("result", JSONB))
    op.add_column("orders", sa.Column("external_id", sa.String(100)))
    op.create_unique_constraint("uq_order_external_id", "orders", ["external_id"])
    for name in ("safety_stock_level", "reorder_level", "reorder_quantity"):
        op.alter_column("inventory", name, nullable=True)
    for name in ("reserved_quantity", "incoming_quantity", "review_days"):
        op.add_column("inventory", sa.Column(name, sa.Integer))
    op.add_column("inventory", sa.Column("supplier_id", sa.UUID, sa.ForeignKey("suppliers.id")))
    op.add_column("inventory", sa.Column("service_level", sa.Numeric(7, 6)))
    op.create_unique_constraint("uq_inventory_route", "inventory", ["warehouse_id", "product_id"])
    # Old thresholds have no measured provenance. They are not model outputs.
    op.execute("UPDATE inventory SET safety_stock_level=NULL, reorder_level=NULL, reorder_quantity=NULL")
    op.create_table("demand_observations",
        sa.Column("id", sa.UUID, primary_key=True),
        sa.Column("product_id", sa.UUID, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("warehouse_id", sa.UUID, sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("observation_date", sa.Date, nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("product_id", "warehouse_id", "observation_date", name="uq_demand_day"),
        sa.CheckConstraint("quantity >= 0", name="ck_demand_nonnegative"))
    op.create_table("lead_time_observations",
        sa.Column("id", sa.UUID, primary_key=True),
        sa.Column("receipt_id", sa.String(100), nullable=False, unique=True),
        sa.Column("product_id", sa.UUID, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("warehouse_id", sa.UUID, sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("supplier_id", sa.UUID, sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("order_date", sa.Date, nullable=False),
        sa.Column("actual_delivery", sa.Date, nullable=False),
        sa.Column("expected_delivery", sa.Date),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("actual_delivery >= order_date", name="ck_lead_chronology"))


def downgrade():
    op.drop_table("lead_time_observations")
    op.drop_table("demand_observations")
    op.drop_constraint("uq_inventory_route", "inventory", type_="unique")
    for name in ("reserved_quantity", "incoming_quantity", "review_days", "supplier_id", "service_level"):
        op.drop_column("inventory", name)
    for name in ("safety_stock_level", "reorder_level", "reorder_quantity"):
        op.execute(sa.text(f"UPDATE inventory SET {name}=0 WHERE {name} IS NULL"))
        op.alter_column("inventory", name, nullable=False)
    op.drop_constraint("uq_order_external_id", "orders", type_="unique")
    op.drop_column("orders", "external_id")
    for name in ("import_mode", "validation_token", "result"):
        op.drop_column("data_imports", name)
