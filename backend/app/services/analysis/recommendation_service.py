"""
Explainable Recommendation Service for the Analysis Module.

Derives prioritized, actionable recommendations directly from ground-truth
risk factors in shipments, suppliers, and inventory positions.
Persists recommendation lifecycle statuses ('Open', 'Reviewed', 'Accepted', 'Rejected', 'Resolved').
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.schemas.analysis import AnalysisRecommendationItem, RiskFindingItem
from app.models.postgres.models import Shipment, Supplier, Inventory, Product

STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage"
STATUS_FILE = STORAGE_DIR / "recommendation_statuses.json"


def _load_persisted_statuses() -> Dict[str, Dict[str, Any]]:
    """Loads saved recommendation status overrides."""
    try:
        if STATUS_FILE.is_file():
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_persisted_status(rec_id: str, status: str, notes: Optional[str] = None) -> None:
    """Persists updated status for a recommendation."""
    try:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        data = _load_persisted_statuses()
        data[rec_id] = {
            "status": status,
            "notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        print(f"[RecommendationService] Warning: Failed to persist status: {exc}")


class RecommendationService:

    @classmethod
    def generate_recommendations(
        cls,
        db: Session,
        risks: Optional[List[RiskFindingItem]] = None,
    ) -> List[AnalysisRecommendationItem]:
        """
        Dynamically analyzes database state and active risks to produce
        explainable, prioritized recommendations with explicit evidence and trade-offs.
        """
        persisted_statuses = _load_persisted_statuses()
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        items: List[AnalysisRecommendationItem] = []

        # ---------------------------------------------------------------------
        # 1. Delayed and Critical Shipments
        # ---------------------------------------------------------------------
        delayed_shipments = (
            db.query(Shipment)
            .filter(Shipment.status.in_(["delayed", "in_transit"]))
            .order_by(Shipment.risk_score.desc())
            .all()
        )

        for shp in delayed_shipments:
            is_overdue = False
            now = datetime.now(timezone.utc)
            if shp.expected_delivery_date:
                exp = shp.expected_delivery_date
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if now > exp:
                    is_overdue = True

            if shp.status == "delayed" or is_overdue or shp.risk_score >= 60:
                rec_id = f"REC-SHP-{shp.shipment_id}"
                status_meta = persisted_statuses.get(rec_id, {})
                current_status = status_meta.get("status", "Open")
                updated_at = status_meta.get("updated_at")

                items.append(
                    AnalysisRecommendationItem(
                        recommendation_id=rec_id,
                        related_risk_id=f"RISK-SHP-{shp.shipment_id}",
                        title=f"Expedite Delayed Shipment {shp.shipment_id} ({shp.transport_mode})",
                        category="Shipment Expediting",
                        suggested_action=(
                            f"Contact {shp.carrier_name} to request expedited priority handling or intermodal "
                            f"rerouting for shipment '{shp.shipment_name}' to {shp.destination}."
                        ),
                        supporting_evidence=[
                            f"Shipment status is '{shp.status}' with risk score {shp.risk_score}/100.",
                            f"Transport Mode: {shp.transport_mode}, Carrier: {shp.carrier_name}.",
                            f"Cargo: {shp.cargo_description} (Qty: {shp.quantity:,}).",
                        ],
                        expected_benefit="Recovers up to 3 days of transit delay and prevents downstream factory starvation.",
                        important_trade_offs="Expedited freight fee (typically +15–25% surcharge); requires carrier slot availability.",
                        required_user_decision="Approve expedited freight surcharge authorization.",
                        priority="CRITICAL" if shp.risk_score >= 80 else "HIGH",
                        status=current_status,
                        created_at=now_str,
                        updated_at=updated_at,
                    )
                )

        # ---------------------------------------------------------------------
        # 2. Critical Inventory Buffers Below Safety Stock
        # ---------------------------------------------------------------------
        inventories = (
            db.query(Inventory)
            .join(Product, Inventory.product_id == Product.id)
            .all()
        )

        for inv in inventories:
            stock = inv.stock_quantity or 0
            reserved = inv.reserved_quantity or 0
            avail = max(0, stock - reserved)
            safety = inv.safety_stock_level or 0
            prod = inv.product
            sku = prod.sku if prod else "SKU-UNKNOWN"
            p_name = prod.name if prod else "Component Assembly"

            if safety > 0 and avail < safety:
                rec_id = f"REC-INV-{sku}"
                status_meta = persisted_statuses.get(rec_id, {})
                current_status = status_meta.get("status", "Open")
                updated_at = status_meta.get("updated_at")

                deficit = safety - avail
                items.append(
                    AnalysisRecommendationItem(
                        recommendation_id=rec_id,
                        related_risk_id=f"RISK-INV-{sku}",
                        title=f"Trigger Emergency Replenishment for {sku}",
                        category="Inventory Replenishment",
                        suggested_action=(
                            f"Issue replenishment order of at least {max(inv.reorder_quantity or 100, deficit):,} units "
                            f"for {p_name} to restore safety buffer headroom."
                        ),
                        supporting_evidence=[
                            f"Available units: {avail:,} vs safety stock requirement: {safety:,} (Deficit: {deficit:,} units).",
                            f"Warehouse: {inv.warehouse.name if inv.warehouse else 'Central Hub'}.",
                            f"Current buffer health is {((avail / safety) * 100):.1f}% of minimum threshold.",
                        ],
                        expected_benefit="Mitigates imminent stockout risk and shields production schedule against unexpected demand spikes.",
                        important_trade_offs="Working capital commitment and potential warehouse holding cost increase.",
                        required_user_decision="Authorize procurement purchase order.",
                        priority="CRITICAL" if avail < (safety * 0.5) else "HIGH",
                        status=current_status,
                        created_at=now_str,
                        updated_at=updated_at,
                    )
                )

        # ---------------------------------------------------------------------
        # 3. High-Risk & Single-Source Suppliers
        # ---------------------------------------------------------------------
        suppliers = db.query(Supplier).filter(Supplier.is_active == True).all()

        for sup in suppliers:
            rel = float(sup.reliability_score or 85.0)
            if sup.single_source_risk or rel < 75.0 or "critical" in (sup.health_status or "").lower():
                rec_id = f"REC-SUP-{sup.supplier_code or sup.id}"
                status_meta = persisted_statuses.get(rec_id, {})
                current_status = status_meta.get("status", "Open")
                updated_at = status_meta.get("updated_at")

                if sup.single_source_risk:
                    title = f"Qualify Secondary Sourcing Alternative for {sup.name}"
                    action = (
                        f"Initiate dual-sourcing qualification for category '{sup.category}' "
                        f"to eliminate single-source dependency on {sup.name}."
                    )
                    trade_off = "Upfront vendor audit and tooling costs; split order volume may reduce bulk volume discounts."
                else:
                    title = f"Conduct Operational Review with {sup.name}"
                    action = (
                        f"Schedule supplier quarterly business review to address {rel:.1f}% reliability "
                        f"and audit lead-time compliance in {sup.location or sup.country}."
                    )
                    trade_off = "Requires procurement and QA team audit hours."

                items.append(
                    AnalysisRecommendationItem(
                        recommendation_id=rec_id,
                        related_risk_id=f"RISK-SUP-{sup.supplier_code or sup.id}",
                        title=title,
                        category="Supplier Engagement",
                        suggested_action=action,
                        supporting_evidence=[
                            f"Supplier Tier: {sup.tier}, Category: {sup.category}.",
                            f"Reliability Score: {rel:.1f}%, Health Status: {sup.health_status}.",
                            f"Single Source Risk: {'Yes' if sup.single_source_risk else 'No'}, Annual Spend: ${float(sup.spend_annual_usd or 0):,.2f}.",
                        ],
                        expected_benefit="Dramatically lowers disruption exposure and improves supplier accountability.",
                        important_trade_offs=trade_off,
                        required_user_decision="Initiate strategic sourcing review or vendor audit.",
                        priority="HIGH" if sup.single_source_risk else "MEDIUM",
                        status=current_status,
                        created_at=now_str,
                        updated_at=updated_at,
                    )
                )

        # Fallback if no critical items found
        if not items:
            rec_id = "REC-NOMINAL-01"
            status_meta = persisted_statuses.get(rec_id, {})
            items.append(
                AnalysisRecommendationItem(
                    recommendation_id=rec_id,
                    related_risk_id=None,
                    title="Maintain Baseline Monitoring Schedule",
                    category="Buffer Adjustment",
                    suggested_action="Continue daily telemetry sync and automated buffer tracking; all core nodes operate within tolerance.",
                    supporting_evidence=[
                        "All active shipments are currently on schedule.",
                        "All tracked inventory products maintain buffers at or above safety stock.",
                        "Supplier reliability metrics exceed established SLA baselines.",
                    ],
                    expected_benefit="Ensures continued smooth operational continuity with minimum overhead.",
                    important_trade_offs="None.",
                    required_user_decision="No action required at this time.",
                    priority="LOW",
                    status=status_meta.get("status", "Open"),
                    created_at=now_str,
                    updated_at=status_meta.get("updated_at"),
                )
            )

        return items

    @classmethod
    def update_recommendation_status(
        cls,
        rec_id: str,
        status: str,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Updates and persists recommendation status."""
        valid_statuses = {"Open", "Reviewed", "Accepted", "Rejected", "Resolved"}
        norm_status = status.capitalize()
        if norm_status not in valid_statuses:
            norm_status = status  # Keep user format if matches

        _save_persisted_status(rec_id, norm_status, notes)

        return {
            "recommendation_id": rec_id,
            "status": norm_status,
            "notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
