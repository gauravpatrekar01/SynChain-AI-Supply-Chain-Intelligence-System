"""Small, numeric-only snapshots for the copilot and AI reports.

Canonical supply-chain entities are shared by authenticated users in the current
schema. User-owned orders, imports and integrations are deliberately excluded.
Do not add raw ORM records, names, contact details or provider configuration here.
"""
from datetime import datetime, timezone
from math import isfinite

from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.models.postgres.models import Inventory, Product, Shipment, Supplier, Warehouse


def _count_if(condition):
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def _number(value):
    if value is None:
        return None
    number = float(value)
    return round(number, 2) if isfinite(number) else None


def build_ai_context(db: Session) -> dict:
    """Read aggregates in SQL; output size stays constant as the database grows."""
    now = datetime.now(timezone.utc)
    available = Inventory.stock_quantity - Inventory.reserved_quantity
    position = available + Inventory.incoming_quantity
    reorder_inputs = and_(
        Inventory.reorder_level > 0,
        Inventory.reserved_quantity.is_not(None),
        Inventory.incoming_quantity.is_not(None),
    )
    inventory = db.query(
        func.count(Inventory.id),
        func.coalesce(func.sum(Inventory.stock_quantity), 0),
        _count_if(reorder_inputs),
        _count_if(and_(reorder_inputs, position <= Inventory.reorder_level)),
        _count_if(and_(Inventory.safety_stock_level > 0, available <= Inventory.safety_stock_level)),
    ).one()
    valid_reliability = and_(Supplier.reliability_score >= 0, Supplier.reliability_score <= 100)
    suppliers = db.query(
        func.count(Supplier.id),
        _count_if(Supplier.single_source_risk.is_(True)),
        _count_if(and_(valid_reliability, Supplier.reliability_score < 70)),
        func.avg(case((valid_reliability, Supplier.reliability_score), else_=None)),
        _count_if(valid_reliability),
    ).filter(Supplier.is_active.is_(True)).one()
    status = func.lower(func.trim(Shipment.status))
    active = status.in_(("pending", "in_transit", "delayed"))
    delivery_observed = and_(
        status == "delivered", Shipment.actual_delivery_date.is_not(None),
        Shipment.expected_delivery_date.is_not(None),
    )
    shipments = db.query(
        func.count(Shipment.id),
        _count_if(active),
        _count_if(and_(active, Shipment.actual_delivery_date.is_(None), Shipment.expected_delivery_date < now)),
        _count_if(delivery_observed),
        _count_if(and_(delivery_observed, Shipment.actual_delivery_date <= Shipment.expected_delivery_date)),
    ).one()
    metrics = {
        "products_count": int(db.query(func.count(Product.id)).scalar() or 0),
        "warehouses_count": int(db.query(func.count(Warehouse.id)).scalar() or 0),
        "inventory_routes_count": int(inventory[0]),
        "inventory_units_total": int(inventory[1]),
        "inventory_routes_with_reorder_inputs": int(inventory[2]),
        "inventory_routes_missing_reorder_inputs": int(inventory[0] - inventory[2]),
        "inventory_routes_at_reorder_point": int(inventory[3]),
        "inventory_routes_below_safety_stock": int(inventory[4]),
        "active_suppliers_count": int(suppliers[0]),
        "single_source_suppliers_count": int(suppliers[1]),
        "suppliers_below_70_reliability_count": int(suppliers[2]),
        "average_supplier_reliability": _number(suppliers[3]),
        "suppliers_with_valid_reliability_count": int(suppliers[4]),
        "shipments_count": int(shipments[0]),
        "active_shipments_count": int(shipments[1]),
        "overdue_shipments_count": int(shipments[2]),
        "completed_shipments_with_delivery_dates_count": int(shipments[3]),
        "on_time_completed_shipments_count": int(shipments[4]),
        "on_time_delivery_pct": round(100 * shipments[4] / shipments[3], 2) if shipments[3] else None,
    }
    limitations = [
        "Shared workspace snapshot: canonical inventory, suppliers and shipments are not tenant-scoped in the current schema.",
        "User-owned orders, imports and integrations, contact details and raw records are excluded.",
        "Inventory reorder checks use on-hand minus reserved plus incoming units and a positive recorded reorder point; missing inputs are unknown.",
        "Safety stock checks use on-hand minus reserved units and a positive recorded safety threshold.",
        "On-time delivery uses only delivered shipments with both expected and actual delivery dates, across all recorded history.",
        "Supplier reliability below 70 is a review threshold, not a prediction of failure.",
        "This snapshot describes recorded data; it does not estimate future demand, financial loss or guaranteed savings.",
    ]
    if not metrics["inventory_routes_count"]:
        limitations.append("No inventory routes are available; inventory risk cannot be assessed.")
    if not metrics["active_suppliers_count"]:
        limitations.append("No active suppliers are available; supplier health cannot be assessed.")
    if not metrics["completed_shipments_with_delivery_dates_count"]:
        limitations.append("No completed shipments have usable delivery dates; on-time delivery is unknown.")
    return {
        "snapshot_at": now.isoformat(),
        "scope": "shared_workspace_aggregates",
        "metrics": metrics,
        "limitations": limitations,
    }
