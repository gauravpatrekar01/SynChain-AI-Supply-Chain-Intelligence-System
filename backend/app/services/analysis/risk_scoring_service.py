"""
Deterministic and Explainable Risk Scoring Service for the Analysis Module.

Calculates normalized 0-100 risk scores with documented factor contributions
and exact classifications:
- 0 to 29: LOW
- 30 to 59: MEDIUM
- 60 to 79: HIGH
- 80 to 100: CRITICAL
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple


def classify_risk_score(score: int) -> str:
    """Exact score boundary mapping."""
    if score >= 80:
        return "CRITICAL"
    elif score >= 60:
        return "HIGH"
    elif score >= 30:
        return "MEDIUM"
    return "LOW"


class AnalysisRiskScorer:
    """Provides transparent, explainable scoring formulas for all supply chain entities."""

    # -------------------------------------------------------------------------
    # 1. Shipment Risk Scoring
    # -------------------------------------------------------------------------
    @classmethod
    def score_shipment(
        cls,
        status: str,
        departure_date: Optional[datetime],
        expected_delivery_date: Optional[datetime],
        actual_delivery_date: Optional[datetime] = None,
        supplier_reliability: Optional[float] = None,
        transport_mode: Optional[str] = "Ocean",
        data_completeness: Optional[str] = "COMPLETE",
        as_of: Optional[datetime] = None,
    ) -> Tuple[int, str, List[Dict[str, Any]], str]:
        """
        Calculates a 0-100 score for a shipment based on:
        - Factor 1 (Weight 0.40): Delay and schedule progress
        - Factor 2 (Weight 0.25): Supplier reliability score
        - Factor 3 (Weight 0.20): Transport corridor sensitivity
        - Factor 4 (Weight 0.15): Tracking and data completeness

        Returns: (score, level, factor_breakdown, narrative_explanation)
        """
        now = as_of or datetime.now(timezone.utc)
        if expected_delivery_date and expected_delivery_date.tzinfo is None:
            expected_delivery_date = expected_delivery_date.replace(tzinfo=timezone.utc)
        if departure_date and departure_date.tzinfo is None:
            departure_date = departure_date.replace(tzinfo=timezone.utc)
        if actual_delivery_date and actual_delivery_date.tzinfo is None:
            actual_delivery_date = actual_delivery_date.replace(tzinfo=timezone.utc)

        factors: List[Dict[str, Any]] = []
        status_norm = (status or "").lower()

        # 1. Delay component
        delay_score = 15
        delay_days = 0.0
        if status_norm == "delayed":
            if expected_delivery_date and now > expected_delivery_date:
                delay_days = (now - expected_delivery_date).total_seconds() / 86400.0
                delay_score = min(100, int(80 + delay_days * 5))
            else:
                delay_score = 85
            delay_desc = f"Actively delayed by carrier ({delay_days:.1f} days past deadline)."
        elif status_norm == "delivered":
            if actual_delivery_date and expected_delivery_date and actual_delivery_date > expected_delivery_date:
                delay_days = (actual_delivery_date - expected_delivery_date).total_seconds() / 86400.0
                delay_score = min(50, int(30 + delay_days * 4))
                delay_desc = f"Delivered {delay_days:.1f} days late."
            else:
                delay_score = 0
                delay_desc = "Delivered on schedule."
        elif expected_delivery_date and now > expected_delivery_date:
            delay_days = (now - expected_delivery_date).total_seconds() / 86400.0
            delay_score = min(100, int(80 + delay_days * 5))
            delay_desc = f"Transit overdue by {delay_days:.1f} days without confirmed delivery."
        elif expected_delivery_date and departure_date:
            duration = max(1.0, (expected_delivery_date - departure_date).total_seconds())
            elapsed = max(0.0, (now - departure_date).total_seconds())
            pct = elapsed / duration
            if pct >= 0.90:
                delay_score = 50
                delay_desc = "Within final 10% of delivery window."
            elif pct >= 0.50:
                delay_score = 25
                delay_desc = "On schedule midway through transit corridor."
            else:
                delay_score = 10
                delay_desc = "Early transit phase with ample schedule buffer."
        else:
            delay_score = 35
            delay_desc = "Schedule timestamps incomplete."

        factors.append({"factor": "Schedule & Delay", "score": delay_score, "weight": 0.40, "detail": delay_desc})

        # 2. Supplier Reliability component
        if supplier_reliability is not None:
            # 100 reliability -> 0 risk; 50 reliability -> 70 risk
            supp_risk = max(0, min(100, int((100.0 - float(supplier_reliability)) * 1.4)))
            supp_desc = f"Supplier historical reliability is {supplier_reliability:.1f}%."
        else:
            supp_risk = 45
            supp_desc = "Supplier reliability rating unrecorded."
        factors.append({"factor": "Supplier Reliability", "score": supp_risk, "weight": 0.25, "detail": supp_desc})

        # 3. Transport corridor sensitivity
        mode_norm = (transport_mode or "Ocean").lower()
        if mode_norm == "ocean":
            mode_risk = 40  # Ocean has higher port congestion risk
            mode_desc = "Maritime freight susceptible to port queues and weather swells."
        elif mode_norm == "air":
            mode_risk = 15  # Air has rapid transit
            mode_desc = "Air priority freight with fast turnaround and lower schedule variance."
        elif mode_norm in ("ground", "road"):
            mode_risk = 25
            mode_desc = "Road transport subject to localized highway corridor congestion."
        elif mode_norm == "rail":
            mode_risk = 30
            mode_desc = "Rail intermodal line with fixed corridor constraints."
        else:
            mode_risk = 30
            mode_desc = f"{transport_mode} transport mode standard baseline."
        factors.append({"factor": "Transport Mode", "score": mode_risk, "weight": 0.20, "detail": mode_desc})

        # 4. Data completeness
        comp_norm = (data_completeness or "COMPLETE").upper()
        if comp_norm == "COMPLETE":
            comp_risk = 5
            comp_desc = "Full telemetry and confirmed tracking metadata."
        else:
            comp_risk = 55
            comp_desc = "Partial tracking telemetry; uncertainty penalty applied."
        factors.append({"factor": "Telemetry Completeness", "score": comp_risk, "weight": 0.15, "detail": comp_desc})

        # Compute weighted sum
        final_score = int(round(sum(f["score"] * f["weight"] for f in factors)))
        final_score = max(0, min(100, final_score))
        level = classify_risk_score(final_score)

        explanation = (
            f"Shipment is classified {level} ({final_score}/100). "
            f"{delay_desc} {supp_desc}"
        )

        return final_score, level, factors, explanation

    # -------------------------------------------------------------------------
    # 2. Supplier Risk Scoring
    # -------------------------------------------------------------------------
    @classmethod
    def score_supplier(
        cls,
        reliability_score: float,
        quality_rating: Optional[float],
        on_time_rate: float,
        delayed_shipments_count: int,
        total_shipments_count: int,
        single_source_risk: bool,
        health_status: str,
        capacity_utilization: Optional[float] = None,
    ) -> Tuple[int, str, List[str], str]:
        """
        Calculates a 0-100 score for a supplier based on:
        - Reliability deficiency (Weight 0.35)
        - Historical shipment delay frequency (Weight 0.25)
        - Quality rating deficiency (Weight 0.15)
        - Single source vulnerability (Weight 0.15)
        - Capacity stress / health status (Weight 0.10)
        """
        risk_factors: List[str] = []
        weighted_scores = []

        # 1. Reliability (0-100%)
        rel_deficiency = max(0.0, min(100.0, 100.0 - reliability_score))
        weighted_scores.append(rel_deficiency * 0.35)
        if reliability_score < 80:
            risk_factors.append(f"Sub-optimal reliability score of {reliability_score:.1f}%")

        # 2. Shipment delay frequency
        if total_shipments_count > 0:
            delay_freq = (delayed_shipments_count / total_shipments_count) * 100.0
            delay_risk = min(100.0, delay_freq * 1.5)
            if delay_freq >= 20.0:
                risk_factors.append(f"{delayed_shipments_count} of {total_shipments_count} shipments delayed ({delay_freq:.0f}%)")
        else:
            delay_risk = 25.0
        weighted_scores.append(delay_risk * 0.25)

        # 3. Quality rating (0-100 or 1-5)
        if quality_rating is not None:
            qual_val = float(quality_rating)
            if qual_val <= 5.0:  # 5-star scale
                qual_pct = (qual_val / 5.0) * 100.0
            else:
                qual_pct = qual_val
            qual_deficiency = max(0.0, min(100.0, 100.0 - qual_pct))
            if qual_pct < 85.0:
                risk_factors.append(f"Quality rating deficiency ({qual_pct:.1f}%)")
        else:
            qual_deficiency = 30.0
        weighted_scores.append(qual_deficiency * 0.15)

        # 4. Single source vulnerability
        if single_source_risk:
            single_source_pts = 85.0
            risk_factors.append("Single-source component supplier without registered fallback alternative")
        else:
            single_source_pts = 10.0
        weighted_scores.append(single_source_pts * 0.15)

        # 5. Capacity stress & Health status
        health_norm = (health_status or "Healthy").lower()
        if "critical" in health_norm:
            health_pts = 90.0
            risk_factors.append("Supplier health status marked as CRITICAL")
        elif "warning" in health_norm or "at risk" in health_norm:
            health_pts = 60.0
            risk_factors.append("Supplier health status under observation (WARNING)")
        else:
            health_pts = 15.0

        if capacity_utilization and capacity_utilization > 0.90:
            health_pts = min(100.0, health_pts + 20.0)
            risk_factors.append(f"High capacity utilization ({capacity_utilization * 100:.0f}%)")

        weighted_scores.append(health_pts * 0.10)

        final_score = int(round(sum(weighted_scores)))
        final_score = max(0, min(100, final_score))
        level = classify_risk_score(final_score)

        if not risk_factors:
            risk_factors.append("Operational performance within nominal boundaries.")

        explanation = (
            f"Supplier exhibits {level} risk profile ({final_score}/100). "
            + "; ".join(risk_factors[:3]) + "."
        )

        return final_score, level, risk_factors, explanation

    # -------------------------------------------------------------------------
    # 3. Inventory Buffer Risk Scoring
    # -------------------------------------------------------------------------
    @classmethod
    def score_inventory(
        cls,
        available_units: int,
        safety_stock: int,
        reorder_point: int,
        days_of_supply: Optional[float],
        average_daily_demand: Optional[float],
        status: str,
    ) -> Tuple[int, str, List[str], str]:
        """
        Calculates a 0-100 score for an inventory record based on:
        - Safety stock breach
        - Days of supply depletion rate
        - Reorder trigger breach
        """
        factors: List[str] = []
        score = 10

        # Safety stock breach
        if safety_stock > 0 and available_units < safety_stock:
            deficit_pct = ((safety_stock - available_units) / safety_stock) * 100.0
            score = max(score, int(min(100, 70 + deficit_pct * 0.3)))
            factors.append(
                f"Available inventory ({available_units}) is below safety threshold ({safety_stock}) by {safety_stock - available_units} units ({deficit_pct:.1f}% breach)"
            )
        elif available_units <= reorder_point:
            score = max(score, 50)
            factors.append(
                f"Available inventory ({available_units}) has breached reorder point ({reorder_point})"
            )

        # Days of supply evaluation
        if days_of_supply is not None:
            if days_of_supply <= 2.0:
                score = max(score, 90)
                factors.append(f"Critical stockout exposure: only {days_of_supply:.1f} days of inventory remaining")
            elif days_of_supply <= 5.0:
                score = max(score, 75)
                factors.append(f"Immediate stockout risk: {days_of_supply:.1f} days of inventory remaining")
            elif days_of_supply <= 10.0:
                score = max(score, 50)
                factors.append(f"Tight buffer window: {days_of_supply:.1f} days of supply")
            elif days_of_supply > 90.0:
                score = max(score, 35)
                factors.append(f"Overstock / excess capital lockup: {days_of_supply:.1f} days of supply")

        # Demand predictability
        if average_daily_demand is None or average_daily_demand <= 0:
            score = max(score, 30)
            factors.append("No active daily consumption rate recorded; stockout estimation has high uncertainty")

        # Status override
        if status == "critical":
            score = max(score, 70)
        elif status == "warning":
            score = max(score, 40)

        score = max(0, min(100, score))
        level = classify_risk_score(score)

        if not factors:
            factors.append("Inventory buffer maintains healthy headroom above safety stock.")

        explanation = (
            f"Inventory item is at {level} risk ({score}/100). "
            + "; ".join(factors[:2]) + "."
        )

        return score, level, factors, explanation
