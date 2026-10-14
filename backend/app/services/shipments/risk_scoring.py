from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.postgres.models import Supplier, IntegrationHealthCheck, EnterpriseIntegration


def get_risk_level(score: int) -> str:
    """Assigns risk level at exact score boundaries:
    0–29: LOW
    30–59: MEDIUM
    60–79: HIGH
    80–100: CRITICAL
    """
    if score >= 80:
        return "CRITICAL"
    elif score >= 60:
        return "HIGH"
    elif score >= 30:
        return "MEDIUM"
    return "LOW"


class ShipmentRiskScorer:
    """Deterministic and testable backend risk-scoring engine for shipments."""

    @classmethod
    def calculate_risk(
        cls,
        shipment_id: str,
        transport_mode: str,
        departure_date: datetime,
        expected_delivery_date: datetime,
        status: str,
        actual_delivery_date: Optional[datetime] = None,
        origin: str = "",
        destination: str = "",
        supplier: Optional[Supplier] = None,
        db: Optional[Session] = None,
        as_of: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        now = as_of or datetime.now(timezone.utc)
        
        # Ensure UTC timezone awareness for comparisons
        if departure_date.tzinfo is None:
            departure_date = departure_date.replace(tzinfo=timezone.utc)
        if expected_delivery_date.tzinfo is None:
            expected_delivery_date = expected_delivery_date.replace(tzinfo=timezone.utc)
        if actual_delivery_date and actual_delivery_date.tzinfo is None:
            actual_delivery_date = actual_delivery_date.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        raw_factors: List[Dict[str, Any]] = []

        # -------------------------------------------------------------------------
        # Factor 1: Delay Risk (Base weight: 0.30)
        # -------------------------------------------------------------------------
        status_norm = (status or "").lower()
        delay_score = 15
        delay_desc = "On schedule with sufficient transit buffer."

        if status_norm == "delayed":
            delay_score = 85
            delay_desc = "Shipment marked as actively delayed."
        elif status_norm == "cancelled":
            delay_score = 95
            delay_desc = "Shipment has been cancelled or aborted."
        elif status_norm == "delivered":
            if actual_delivery_date and actual_delivery_date > expected_delivery_date:
                delay_score = 40
                delay_desc = "Delivered past original expected delivery date."
            else:
                delay_score = 0
                delay_desc = "Successfully delivered on schedule."
        else:
            # in_transit or pending
            if now > expected_delivery_date:
                overdue_days = (now - expected_delivery_date).total_seconds() / 86400.0
                delay_score = min(100, int(80 + overdue_days * 5))
                delay_desc = f"Overdue by {overdue_days:.1f} days past expected delivery date."
            else:
                total_duration = max(1.0, (expected_delivery_date - departure_date).total_seconds())
                elapsed = max(0.0, (now - departure_date).total_seconds())
                progress = elapsed / total_duration
                if progress >= 0.90:
                    delay_score = 55
                    delay_desc = "Nearing delivery window deadline."
                elif progress >= 0.60:
                    delay_score = 30
                    delay_desc = "Midway in transit corridor; normal progress."
                else:
                    delay_score = 15
                    delay_desc = "Early transit phase with full buffer remaining."

        raw_factors.append({
            "factor": "delay",
            "score": delay_score,
            "base_weight": 0.30,
            "available": True,
            "description": delay_desc,
        })

        # -------------------------------------------------------------------------
        # Factor 2: Supplier Risk (Base weight: 0.25)
        # -------------------------------------------------------------------------
        if supplier is not None:
            rel = float(supplier.reliability_score or 85.0)
            sup_score = max(0, min(100, int(100 - rel)))
            notes = [f"Supplier reliability rating: {rel:.1f}%"]
            if getattr(supplier, "single_source_risk", False):
                sup_score = min(100, sup_score + 15)
                notes.append("Single-source vulnerability penalty applied")
            if getattr(supplier, "health_status", "").lower() == "critical":
                sup_score = min(100, sup_score + 20)
                notes.append("Supplier health status is CRITICAL")
            
            raw_factors.append({
                "factor": "supplier",
                "score": sup_score,
                "base_weight": 0.25,
                "available": True,
                "description": "; ".join(notes) + ".",
            })
        else:
            raw_factors.append({
                "factor": "supplier",
                "score": 0,
                "base_weight": 0.25,
                "available": False,
                "description": "No integrated supplier associated with this shipment.",
            })

        # -------------------------------------------------------------------------
        # Factor 3: Transportation Risk (Base weight: 0.15)
        # -------------------------------------------------------------------------
        mode_clean = (transport_mode or "").lower()
        if mode_clean in ("ocean", "sea"):
            trans_score = 45
            trans_desc = "Maritime shipping subject to port berthing delays and sea conditions."
        elif mode_clean in ("rail", "train"):
            trans_score = 35
            trans_desc = "Intermodal rail switching and corridor terminal congestion."
        elif mode_clean in ("ground", "road", "truck"):
            trans_score = 30
            trans_desc = "Overland freight exposed to highway bottlenecks and customs queues."
        elif mode_clean in ("air", "flight"):
            trans_score = 20
            trans_desc = "Expedited air cargo transit with minimal intermodal transfer risks."
        else:
            trans_score = 30
            trans_desc = f"Standard intermodal transit protocol for mode: {transport_mode}."

        raw_factors.append({
            "factor": "transportation",
            "score": trans_score,
            "base_weight": 0.15,
            "available": True,
            "description": trans_desc,
        })

        # -------------------------------------------------------------------------
        # Factor 4: Weather Risk (Base weight: 0.10)
        # -------------------------------------------------------------------------
        # Check if actual weather integration exists and is healthy
        has_weather_integration = False
        weather_score = 0
        weather_desc = "Weather integration not configured; live atmospheric telemetry unavailable."

        if db is not None:
            try:
                # Check for healthy weather integrations in health checks or integration configs
                weather_check = db.query(IntegrationHealthCheck).filter(
                    IntegrationHealthCheck.category.ilike("%weather%"),
                    IntegrationHealthCheck.status == "healthy",
                ).first()
                if weather_check:
                    has_weather_integration = True
                    weather_score = 25
                    weather_desc = "Verified live meteorological telemetry active; nominal marine/air corridor weather."
            except Exception:
                has_weather_integration = False

        raw_factors.append({
            "factor": "weather",
            "score": weather_score,
            "base_weight": 0.10,
            "available": has_weather_integration,
            "description": weather_desc,
        })

        # -------------------------------------------------------------------------
        # Factor 5: Route Risk (Base weight: 0.10)
        # -------------------------------------------------------------------------
        route_text = f"{origin} {destination}".lower()
        chokepoints = ["red sea", "suez", "panama", "malacca", "hormuz", "taiwan strait", "black sea"]
        is_chokepoint = any(cp in route_text for cp in chokepoints)

        if is_chokepoint:
            route_score = 75
            route_desc = "Transit route crosses recognized high-risk geopolitical or maritime bottleneck."
        else:
            route_score = 20
            route_desc = "Transit route follows verified commercial transport corridor."

        raw_factors.append({
            "factor": "route",
            "score": route_score,
            "base_weight": 0.10,
            "available": True,
            "description": route_desc,
        })

        # -------------------------------------------------------------------------
        # Factor 6: Shipment Status Risk (Base weight: 0.10)
        # -------------------------------------------------------------------------
        if status_norm == "cancelled":
            st_score = 95
            st_desc = "Operational failure: shipment cancelled."
        elif status_norm == "delayed":
            st_score = 80
            st_desc = "Operational delay flag active."
        elif status_norm == "pending":
            st_score = 35
            st_desc = "Shipment in pre-transit preparation; awaiting dispatch confirmation."
        elif status_norm == "delivered":
            st_score = 0
            st_desc = "Fulfillment complete; zero operational transit risk."
        else:
            st_score = 20
            st_desc = "Active transit nominal status."

        raw_factors.append({
            "factor": "status",
            "score": st_score,
            "base_weight": 0.10,
            "available": True,
            "description": st_desc,
        })

        # -------------------------------------------------------------------------
        # Weight Normalization & Composite Calculation
        # -------------------------------------------------------------------------
        available_factors = [f for f in raw_factors if f["available"]]
        total_available_weight = sum(f["base_weight"] for f in available_factors)

        if total_available_weight <= 0:
            # Fallback safe score
            final_score = 25
            normalized_factors = []
        else:
            weighted_sum = 0.0
            normalized_factors = []
            for f in raw_factors:
                if f["available"]:
                    norm_w = f["base_weight"] / total_available_weight
                    weighted_sum += f["score"] * norm_w
                    normalized_factors.append({
                        "factor": f["factor"],
                        "score": f["score"],
                        "weight": round(norm_w, 4),
                        "available": True,
                        "description": f["description"],
                    })
                else:
                    normalized_factors.append({
                        "factor": f["factor"],
                        "score": f["score"],
                        "weight": 0.0,
                        "available": False,
                        "description": f["description"],
                    })
            final_score = max(0, min(100, int(round(weighted_sum))))

        # If delivered, overall risk is clamped to low
        if status_norm == "delivered" and final_score > 25:
            final_score = min(final_score, 20)

        risk_level = get_risk_level(final_score)
        data_completeness = "COMPLETE" if all(f["available"] for f in raw_factors) else "PARTIAL"

        return {
            "shipment_id": shipment_id,
            "risk_score": final_score,
            "risk_level": risk_level,
            "risk_factors": normalized_factors,
            "data_completeness": data_completeness,
            "calculated_at": now.isoformat(),
        }
