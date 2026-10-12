import os
import sys
import json
import time
import uuid
import warnings
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

# Suppress sklearn unpickle version warnings cleanly
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    import joblib

from app.core.config import settings
from app.models.postgres.models import Supplier as DBSupplier

# ---------------------------------------------------------------------------
# Paths and Constants
# ---------------------------------------------------------------------------

# Resolve ml-lab directories relative to repository root
_CURRENT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CURRENT_DIR.parents[2]
_REPO_ROOT = _BACKEND_DIR.parent
_ML_LAB_DIR = _REPO_ROOT / "ml-lab"

DEFAULT_MODEL_PATH = _ML_LAB_DIR / "models" / "delay_model.joblib"
DEFAULT_SUPPLIER_MASTER_PATH = _ML_LAB_DIR / "data" / "raw" / "supplier_master.csv"
DEFAULT_SHIPMENT_HISTORY_PATH = _ML_LAB_DIR / "data" / "raw" / "shipment_history.csv"
DEFAULT_REPORTS_DIR = _ML_LAB_DIR / "reports"

FEATURE_COLUMNS = [
    "supplier_location",
    "component_type",
    "transport_mode",
    "distance_km",
    "weather_condition",
    "seasonal_rainy_period",
    "traffic_level",
    "supplier_risk_rating",
    "supplier_on_time_rate",
    "supplier_quality_rate",
    "supplier_capacity_utilization",
    "order_quantity",
    "inventory_at_order",
    "planned_lead_time_days",
    "unit_cost",
]

REQUIRED_SUPPLIER_COLUMNS = {
    "supplier_id",
    "supplier_name",
    "location",
    "component_types",
    "average_lead_time_days",
    "on_time_delivery_rate",
    "quality_rate",
    "unit_cost_index",
    "available_capacity_units",
    "distance_from_warehouse_km",
    "active",
}


class MLIntelligenceService:
    """
    Dedicated ML intelligence service adapter integrating the committed
    ml-lab models into the SynChain-AI backend platform.
    """

    _model: Optional[Any] = None
    _model_lock = threading.Lock()
    _model_loaded_at: Optional[float] = None
    _model_path: Path = DEFAULT_MODEL_PATH

    @classmethod
    def get_model_path(cls) -> Path:
        custom_path = getattr(settings, "ML_MODEL_PATH", None)
        if custom_path:
            return Path(custom_path)
        return DEFAULT_MODEL_PATH

    @classmethod
    def load_model(cls) -> Any:
        """Loads and caches the delay prediction model in memory (thread-safe)."""
        if cls._model is not None:
            return cls._model

        with cls._model_lock:
            if cls._model is not None:
                return cls._model

            model_file = cls.get_model_path()
            if not model_file.exists():
                raise FileNotFoundError(
                    f"Committed ML model artifact not found at {model_file}. "
                    "Ensure delay_model.joblib is present in ml-lab/models/."
                )

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                cls._model = joblib.load(model_file)
                cls._model_loaded_at = time.time()
                cls._model_path = model_file

        return cls._model

    @classmethod
    def predict_shipment(cls, shipment: Dict[str, Any]) -> Dict[str, Any]:
        """
        Estimates shipment delay probability using the committed RandomForest model.
        Validates required features and maps data cleanly.
        """
        missing_features = [col for col in FEATURE_COLUMNS if col not in shipment]
        if missing_features:
            raise ValueError(
                f"Shipment is missing required features: {', '.join(missing_features)}"
            )

        model = cls.load_model()

        # Build feature DataFrame with exact column ordering
        input_data = pd.DataFrame([
            {col: shipment[col] for col in FEATURE_COLUMNS}
        ])

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            probabilities = model.predict_proba(input_data)[0]

        classes = list(model.named_steps["classifier"].classes_)
        delayed_idx = classes.index(1) if 1 in classes else 1
        delay_prob = float(probabilities[delayed_idx])

        if delay_prob >= 0.70:
            risk_level = "HIGH"
        elif delay_prob >= 0.40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "delay_probability": round(delay_prob, 4),
            "delay_probability_percent": round(delay_prob * 100, 2),
            "risk_level": risk_level,
            "model_type": "RandomForestClassifier",
            "data_source": "synthetic_development_data",
            "production_ready": False,
        }

    @classmethod
    def load_suppliers(cls, db: Optional[Session] = None) -> pd.DataFrame:
        """
        Loads supplier master data with priority:
        1. Live database records if present and populated.
        2. Reference supplier_master.csv from ml-lab.
        """
        db_records: List[Dict[str, Any]] = []

        # Try live database records
        if db is not None:
            try:
                db_sups = db.query(DBSupplier).all()
                for s in db_sups:
                    db_records.append({
                        "supplier_id": f"DB-SUP-{str(s.id)[:8]}",
                        "supplier_name": s.name,
                        "location": s.country or "Global",
                        "component_types": s.category or "Battery;Chassis;ECU;Semiconductor",
                        "average_lead_time_days": 4.0 if s.single_source_risk else 3.0,
                        "on_time_delivery_rate": float(s.reliability_score) / 100.0,
                        "quality_rate": 0.92,
                        "unit_cost_index": 100.0,
                        "available_capacity_units": 5000,
                        "distance_from_warehouse_km": 350,
                        "active": 1 if s.health_status != "critical" else 0,
                    })
            except Exception:
                pass

        # Try MongoDB Atlas suppliers
        if not db_records and getattr(settings, "MONGODB_URL", None):
            try:
                from app.core.mongodb import suppliers_col
                mongo_sups = list(suppliers_col().find({}))
                for s in mongo_sups:
                    db_records.append({
                        "supplier_id": f"MGO-SUP-{str(s.get('_id', s.get('id', 'unknown')))[:8]}",
                        "supplier_name": s.get("name", "Atlas Supplier"),
                        "location": s.get("country", "Global"),
                        "component_types": s.get("category", "Battery;Chassis;ECU;Semiconductor"),
                        "average_lead_time_days": 4.0 if s.get("single_source_risk") else 3.0,
                        "on_time_delivery_rate": float(s.get("reliability_score", 85.0)) / 100.0,
                        "quality_rate": 0.92,
                        "unit_cost_index": 100.0,
                        "available_capacity_units": 5000,
                        "distance_from_warehouse_km": 350,
                        "active": 1,
                    })
            except Exception:
                pass

        # Fallback to committed reference CSV
        csv_path = DEFAULT_SUPPLIER_MASTER_PATH
        if csv_path.exists():
            csv_df = pd.read_csv(csv_path)
            if not csv_df.empty:
                if db_records:
                    # Combine live records with master CSV
                    db_df = pd.DataFrame(db_records)
                    return pd.concat([db_df, csv_df], ignore_index=True).drop_duplicates(subset=["supplier_name"])
                return csv_df

        if db_records:
            return pd.DataFrame(db_records)

        raise FileNotFoundError(
            f"Supplier dataset not found at {csv_path} and no live database suppliers available."
        )

    @staticmethod
    def _supports_component(supplier_row: pd.Series, component_type: str) -> bool:
        supported = [
            c.strip().casefold()
            for c in str(supplier_row.get("component_types", "")).split(";")
            if str(c).strip()
        ]
        return component_type.casefold() in supported

    @classmethod
    def recommend_suppliers(
        cls,
        shipment: Dict[str, Any],
        max_results: int = 5,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Recommends alternative suppliers based on multi-criteria ranking:
        40% delay probability + 25% lead time + 20% quality rate + 15% unit cost index.
        """
        if not isinstance(shipment, dict):
            raise TypeError("Shipment must be provided as a dictionary.")

        if "component_type" not in shipment or not str(shipment["component_type"]).strip():
            raise ValueError("Shipment is missing required field: component_type.")

        if "order_quantity" not in shipment:
            raise ValueError("Shipment is missing required field: order_quantity.")

        try:
            order_qty = int(shipment["order_quantity"])
        except (TypeError, ValueError) as e:
            raise ValueError("order_quantity must be a positive integer.") from e

        if order_qty <= 0:
            raise ValueError("order_quantity must be greater than zero.")

        component_type = str(shipment["component_type"]).strip()
        suppliers = cls.load_suppliers(db=db)

        if suppliers.empty:
            return []

        # Filter active and capacity-eligible suppliers
        eligible = suppliers[
            (pd.to_numeric(suppliers["active"], errors="coerce").fillna(0) == 1)
            & (
                pd.to_numeric(
                    suppliers["available_capacity_units"], errors="coerce"
                ).fillna(0)
                >= order_qty
            )
        ].copy()

        eligible = eligible[
            eligible.apply(
                cls._supports_component,
                axis=1,
                component_type=component_type,
            )
        ].copy()

        if eligible.empty:
            return []

        recommendations = []
        for _, sup in eligible.iterrows():
            candidate = shipment.copy()
            candidate["component_type"] = component_type
            candidate["order_quantity"] = order_qty
            candidate["supplier_location"] = sup.get("location", "Pune")
            candidate["supplier_on_time_rate"] = float(sup.get("on_time_delivery_rate", 0.85))
            candidate["supplier_quality_rate"] = float(sup.get("quality_rate", 0.90))
            candidate["supplier_risk_rating"] = (
                "Low" if candidate["supplier_on_time_rate"] >= 0.90
                else "Medium" if candidate["supplier_on_time_rate"] >= 0.80
                else "High"
            )

            cap = float(pd.to_numeric(sup.get("available_capacity_units", 1000), errors="coerce") or 1000)
            candidate["supplier_capacity_utilization"] = min(1.0, order_qty / cap) if cap > 0 else 1.0
            candidate["distance_km"] = float(sup.get("distance_from_warehouse_km", 450))

            # Fill other default features if not provided in payload
            candidate.setdefault("transport_mode", "Road")
            candidate.setdefault("weather_condition", "Rain")
            candidate.setdefault("seasonal_rainy_period", 1)
            candidate.setdefault("traffic_level", "High")
            candidate.setdefault("inventory_at_order", 200)
            candidate.setdefault("planned_lead_time_days", int(sup.get("average_lead_time_days", 5)))
            candidate.setdefault("unit_cost", float(sup.get("unit_cost_index", 250.0)))

            pred = cls.predict_shipment(candidate)
            delay_risk = float(pred["delay_probability"])
            lead_time = float(sup.get("average_lead_time_days", 4.0))
            quality_rate = float(sup.get("quality_rate", 0.90))
            cost_index = float(sup.get("unit_cost_index", 100.0))

            recommendations.append({
                "supplier_id": str(sup.get("supplier_id")),
                "supplier_name": str(sup.get("supplier_name")),
                "location": str(sup.get("location")),
                "component_type": component_type,
                "estimated_delay_probability": delay_risk,
                "estimated_delay_percent": round(delay_risk * 100, 2),
                "average_lead_time_days": lead_time,
                "quality_rate": quality_rate,
                "unit_cost_index": cost_index,
                "available_capacity_units": int(cap),
                "on_time_delivery_rate": float(sup.get("on_time_delivery_rate", 0.85)),
                "recommendation_score": None,
                "prediction_source": pred.get("data_source", "synthetic_development_data"),
            })

        results = pd.DataFrame(recommendations)
        if results.empty:
            return []

        results["delay_rank"] = results["estimated_delay_probability"].rank(pct=True)
        results["lead_time_rank"] = results["average_lead_time_days"].rank(pct=True)
        results["quality_rank"] = results["quality_rate"].rank(pct=True, ascending=False)
        results["cost_rank"] = results["unit_cost_index"].rank(pct=True)
        results["recommendation_score"] = (
            0.40 * results["delay_rank"]
            + 0.25 * results["lead_time_rank"]
            + 0.20 * results["quality_rank"]
            + 0.15 * results["cost_rank"]
        ).round(6)

        results = results.sort_values(by=["recommendation_score", "estimated_delay_probability"], ascending=True)
        output = results.head(max_results).drop(columns=["delay_rank", "lead_time_rank", "quality_rank", "cost_rank"])

        return output.to_dict(orient="records")

    @classmethod
    def simulate_scenario(
        cls,
        scenario_name: str,
        initial_inventory: int,
        daily_demand: int,
        simulation_days: int,
        supplier_lead_time: int,
        shipment_quantity: int,
        shipment_day: int = 1,
    ) -> pd.DataFrame:
        """Deterministic single-shipment inventory simulation."""
        inventory = int(initial_inventory)
        demand_per_day = int(daily_demand)
        sim_days = int(simulation_days)
        lead_time = int(supplier_lead_time)
        arrival_day = int(shipment_day) + lead_time
        records = []
        cumulative_unmet = 0

        for day in range(1, sim_days + 1):
            starting_inv = inventory
            incoming = shipment_quantity if day == arrival_day else 0
            inventory += incoming

            fulfilled = min(inventory, demand_per_day)
            unmet = demand_per_day - fulfilled
            inventory -= fulfilled
            cumulative_unmet += unmet

            records.append({
                "scenario": scenario_name,
                "day": day,
                "starting_inventory": starting_inv,
                "incoming_quantity": incoming,
                "demand": demand_per_day,
                "fulfilled_demand": fulfilled,
                "unmet_demand": unmet,
                "ending_inventory": inventory,
                "cumulative_unmet_demand": cumulative_unmet,
            })

        return pd.DataFrame(records)

    @classmethod
    def simulate_replenishment(
        cls,
        initial_inventory: int,
        daily_demand: int,
        simulation_days: int,
        supplier_lead_time: int,
        reorder_point: int,
        order_quantity: int,
    ) -> List[Dict[str, Any]]:
        """Simulates inventory replenishment using reorder point policy."""
        inventory = int(initial_inventory)
        demand_per_day = int(daily_demand)
        sim_days = int(simulation_days)
        lead_time = int(supplier_lead_time)
        reorder_pt = int(reorder_point)
        order_qty = int(order_quantity)

        pending_orders: List[Dict[str, Any]] = []
        results: List[Dict[str, Any]] = []
        total_unmet = 0

        for day in range(1, sim_days + 1):
            starting_inv = inventory
            incoming = 0

            arriving = [o for o in pending_orders if o["arrival_day"] <= day]
            for order in arriving:
                incoming += order["quantity"]
            pending_orders = [o for o in pending_orders if o["arrival_day"] > day]

            inventory += incoming
            fulfilled = min(inventory, demand_per_day)
            unmet = demand_per_day - fulfilled
            inventory -= fulfilled
            total_unmet += unmet

            order_placed = 0
            if inventory <= reorder_pt and not pending_orders:
                order_placed = order_qty
                if lead_time == 0:
                    inventory += order_qty
                    incoming += order_qty
                else:
                    pending_orders.append({
                        "order_day": day,
                        "arrival_day": day + lead_time,
                        "quantity": order_qty,
                    })

            results.append({
                "scenario": "automatic_replenishment",
                "day": day,
                "starting_inventory": starting_inv,
                "incoming_quantity": incoming,
                "demand": demand_per_day,
                "fulfilled_demand": fulfilled,
                "unmet_demand": unmet,
                "ending_inventory": inventory,
                "order_placed": order_placed,
                "pending_orders": len(pending_orders),
                "cumulative_unmet_demand": total_unmet,
            })

        return results

    @classmethod
    def run_inventory_simulation(
        cls,
        initial_inventory: int = 300,
        daily_demand: int = 100,
        simulation_days: int = 30,
        shipment_quantity: int = 1000,
        component_type: str = "Battery",
        db: Optional[Session] = None,
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Runs comprehensive multi-scenario simulation:
        1. Baseline (fixed 5-day lead time)
        2. Mitigated (alternative supplier selected via ML model)
        3. Automatic Replenishment (reorder point policy)
        """
        if daily_demand <= 0:
            raise ValueError("daily_demand must be greater than zero.")
        if shipment_quantity <= 0:
            raise ValueError("shipment_quantity must be greater than zero.")

        # Find best alternative supplier
        shipment_req = {
            "component_type": component_type,
            "order_quantity": shipment_quantity,
            "inventory_at_order": initial_inventory,
        }
        recs = cls.recommend_suppliers(shipment_req, max_results=3, db=db)
        if not recs:
            # Fallback supplier if none eligible
            selected_supplier = {
                "supplier_id": "SUP-FALLBACK-1",
                "supplier_name": "Apex Micro-Logistics",
                "location": "Pune",
                "average_lead_time_days": 3.0,
                "estimated_delay_probability": 0.22,
                "available_capacity_units": 8000,
                "quality_rate": 0.94,
                "on_time_delivery_rate": 0.96,
                "prediction_source": "synthetic_development_data",
            }
        else:
            selected_supplier = recs[0]

        alt_lead_time = int(selected_supplier["average_lead_time_days"])

        baseline = cls.simulate_scenario(
            scenario_name="baseline",
            initial_inventory=initial_inventory,
            daily_demand=daily_demand,
            simulation_days=simulation_days,
            supplier_lead_time=5,
            shipment_quantity=shipment_quantity,
            shipment_day=1,
        )

        mitigated = cls.simulate_scenario(
            scenario_name="mitigated",
            initial_inventory=initial_inventory,
            daily_demand=daily_demand,
            simulation_days=simulation_days,
            supplier_lead_time=alt_lead_time,
            shipment_quantity=shipment_quantity,
            shipment_day=1,
        )

        reorder_point = daily_demand * 3
        replenishment_records = cls.simulate_replenishment(
            initial_inventory=initial_inventory,
            daily_demand=daily_demand,
            simulation_days=simulation_days,
            supplier_lead_time=alt_lead_time,
            reorder_point=reorder_point,
            order_quantity=shipment_quantity,
        )
        automatic = pd.DataFrame(replenishment_records)

        combined = pd.concat([baseline, mitigated, automatic], ignore_index=True)

        summary: Dict[str, Any] = {}
        for sc_name, sc_data in combined.groupby("scenario"):
            stockout_days = sc_data.loc[sc_data["unmet_demand"] > 0, "day"]
            summary[sc_name] = {
                "ending_inventory": int(sc_data["ending_inventory"].iloc[-1]),
                "total_unmet_demand": int(sc_data["unmet_demand"].sum()),
                "days_with_stockout": int((sc_data["unmet_demand"] > 0).sum()),
                "first_stockout_day": int(stockout_days.iloc[0]) if not stockout_days.empty else None,
            }

        summary["selected_supplier"] = selected_supplier
        summary["replenishment_settings"] = {
            "reorder_point": reorder_point,
            "order_quantity": shipment_quantity,
            "supplier_lead_time_days": alt_lead_time,
        }

        return combined, summary

    @classmethod
    def generate_decision_report(
        cls,
        initial_inventory: int = 300,
        daily_demand: int = 100,
        simulation_days: int = 30,
        shipment_quantity: int = 1000,
        component_type: str = "Battery",
        output_file: Optional[Path] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Generates executive decision report from live multi-scenario simulation."""
        combined, summary = cls.run_inventory_simulation(
            initial_inventory=initial_inventory,
            daily_demand=daily_demand,
            simulation_days=simulation_days,
            shipment_quantity=shipment_quantity,
            component_type=component_type,
            db=db,
        )

        selected_supplier = summary["selected_supplier"]
        baseline = summary["baseline"]
        mitigated = summary["mitigated"]
        replenishment = summary["automatic_replenishment"]

        b_first = baseline["first_stockout_day"]
        m_first = mitigated["first_stockout_day"]
        stockout_delay_delta = (m_first - b_first) if (b_first is not None and m_first is not None) else None
        unmet_delta = mitigated["total_unmet_demand"] - baseline["total_unmet_demand"]

        stockout_finding = (
            f"The alternative supplier delays the first stockout by {stockout_delay_delta} days."
            if stockout_delay_delta and stockout_delay_delta > 0
            else "The alternative supplier maintains nominal stockout timing."
        )

        demand_finding = (
            f"The alternative supplier reduces unmet demand by {abs(unmet_delta)} units."
            if unmet_delta < 0
            else "Total unmet demand is comparable between scenarios."
        )

        findings = {
            "stockout_delay": stockout_delay_delta,
            "unmet_demand_change": unmet_delta,
            "stockout_finding": stockout_finding,
            "demand_finding": demand_finding,
            "replenishment_finding": (
                "Automatic replenishment eliminates stockouts during the simulation period."
                if replenishment["first_stockout_day"] is None
                else f"Automatic replenishment first stockout on Day {replenishment['first_stockout_day']}."
            ),
            "next_action": "Activate alternative supplier agreement with automatic reorder triggers.",
        }

        report_lines = [
            "=" * 65,
            "             SYNCHAIN AI - DECISION REPORT",
            "=" * 65,
            "",
            "1. SIMULATION OVERVIEW",
            "Scenarios analyzed: BASELINE, MITIGATED, AUTOMATIC REPLENISHMENT",
            f"Simulation period: {simulation_days} days",
            "",
            "2. INVENTORY COMPARISON",
            f"BASELINE: Ending inventory: {baseline['ending_inventory']} units | Unmet: {baseline['total_unmet_demand']} units | First stockout: Day {baseline['first_stockout_day']}",
            f"MITIGATED: Ending inventory: {mitigated['ending_inventory']} units | Unmet: {mitigated['total_unmet_demand']} units | First stockout: Day {mitigated['first_stockout_day']}",
            f"AUTOMATIC REPLENISHMENT: Ending inventory: {replenishment['ending_inventory']} units | Unmet: {replenishment['total_unmet_demand']} units | First stockout: {replenishment['first_stockout_day'] or 'None'}",
            "",
            "3. RECOMMENDED ALTERNATIVE SUPPLIER",
            f"Supplier Name: {selected_supplier['supplier_name']} ({selected_supplier['supplier_id']})",
            f"Location: {selected_supplier['location']}",
            f"Estimated Delay Probability: {selected_supplier.get('estimated_delay_percent', 0.0)}%",
            f"Average Lead Time: {selected_supplier.get('average_lead_time_days', 0.0)} days",
            f"Available Capacity: {selected_supplier.get('available_capacity_units', 0)} units",
            "",
            "4. KEY FINDINGS",
            f"- {stockout_finding}",
            f"- {demand_finding}",
            "",
            "5. RECOMMENDED NEXT ACTION",
            f"{findings['next_action']}",
            "=" * 65,
        ]

        report_text = "\n".join(report_lines)
        report_path_str = None
        if output_file is not None:
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(report_text, encoding="utf-8")
            report_path_str = str(output_file)

        return {
            "summaries": {
                "baseline": baseline,
                "mitigated": mitigated,
                "automatic_replenishment": replenishment,
            },
            "selected_supplier": selected_supplier,
            "findings": findings,
            "report_text": report_text,
            "report_path": report_path_str,
        }

    @classmethod
    def check_model_health(cls) -> Dict[str, Any]:
        """
        Health check auditing the machine-learning delay model and datasets.
        """
        model_file = cls.get_model_path()
        model_exists = model_file.exists()
        supplier_exists = DEFAULT_SUPPLIER_MASTER_PATH.exists()
        history_exists = DEFAULT_SHIPMENT_HISTORY_PATH.exists()

        if not model_exists:
            return {
                "model_loaded": False,
                "model_path": str(model_file),
                "model_type": "None",
                "expected_features": FEATURE_COLUMNS,
                "features_count": len(FEATURE_COLUMNS),
                "reference_data_status": {
                    "supplier_master": supplier_exists,
                    "shipment_history": history_exists,
                },
                "status": "unhealthy",
                "test_inference_latency_ms": None,
                "message": f"Model artifact not found at {model_file}",
            }

        start_time = time.perf_counter()
        try:
            model = cls.load_model()
            # Perform dummy inference to confirm pipeline execution
            sample = {
                "supplier_location": "Pune",
                "component_type": "Battery",
                "transport_mode": "Road",
                "distance_km": 450,
                "weather_condition": "Rain",
                "seasonal_rainy_period": 1,
                "traffic_level": "High",
                "supplier_risk_rating": "Medium",
                "supplier_on_time_rate": 0.82,
                "supplier_quality_rate": 0.91,
                "supplier_capacity_utilization": 0.85,
                "order_quantity": 500,
                "inventory_at_order": 200,
                "planned_lead_time_days": 5,
                "unit_cost": 250.0,
            }
            pred = cls.predict_shipment(sample)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return {
                "model_loaded": True,
                "model_path": str(model_file),
                "model_type": pred.get("model_type", "RandomForestClassifier"),
                "expected_features": FEATURE_COLUMNS,
                "features_count": len(FEATURE_COLUMNS),
                "reference_data_status": {
                    "supplier_master": supplier_exists,
                    "shipment_history": history_exists,
                },
                "status": "healthy",
                "test_inference_latency_ms": latency_ms,
                "message": "Delay model and preprocessor pipeline operational.",
            }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "model_loaded": False,
                "model_path": str(model_file),
                "model_type": "RandomForestClassifier",
                "expected_features": FEATURE_COLUMNS,
                "features_count": len(FEATURE_COLUMNS),
                "reference_data_status": {
                    "supplier_master": supplier_exists,
                    "shipment_history": history_exists,
                },
                "status": "unhealthy",
                "test_inference_latency_ms": latency_ms,
                "message": f"Model test inference failed: {str(e)}",
            }
