from pathlib import Path

import pandas as pd

from predict import predict_shipment


# --------------------------------------------------
# 1. Project paths
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

SUPPLIER_FILE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "supplier_master.csv"
)

REQUIRED_SHIPMENT_FIELDS = (
    "component_type",
    "order_quantity",
)

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


# --------------------------------------------------
# 2. Input validation helpers
# --------------------------------------------------

def validate_shipment(shipment: dict) -> dict:
    if not isinstance(shipment, dict):
        raise TypeError("Shipment must be provided as a dictionary.")

    missing_fields = [
        field for field in REQUIRED_SHIPMENT_FIELDS if field not in shipment
    ]
    if missing_fields:
        raise ValueError(
            "Shipment is missing required fields: "
            + ", ".join(missing_fields)
        )

    normalized = shipment.copy()
    normalized["component_type"] = str(shipment["component_type"]).strip()
    if not normalized["component_type"]:
        raise ValueError("component_type cannot be empty.")

    try:
        normalized["order_quantity"] = int(shipment["order_quantity"])
    except (TypeError, ValueError) as exc:
        raise ValueError("order_quantity must be a positive integer.") from exc

    if normalized["order_quantity"] <= 0:
        raise ValueError("order_quantity must be greater than zero.")

    return normalized


# --------------------------------------------------
# 3. Load supplier data
# --------------------------------------------------

def load_suppliers() -> pd.DataFrame:
    if not SUPPLIER_FILE.exists():
        raise FileNotFoundError(
            f"Supplier dataset not found: {SUPPLIER_FILE}"
        )

    suppliers = pd.read_csv(SUPPLIER_FILE)
    if suppliers.empty:
        return suppliers

    missing_columns = sorted(
        REQUIRED_SUPPLIER_COLUMNS - set(suppliers.columns)
    )
    if missing_columns:
        raise ValueError(
            "Supplier dataset is missing required columns: "
            + ", ".join(missing_columns)
        )

    return suppliers


# --------------------------------------------------
# 4. Check whether a supplier supports a component
# --------------------------------------------------

def supports_component(
    supplier_row: pd.Series,
    component_type: str,
) -> bool:
    supported_components = [
        component.strip().casefold()
        for component in str(
            supplier_row.get("component_types", "")
        ).split(";")
        if str(component).strip()
    ]

    return component_type.casefold() in supported_components


# --------------------------------------------------
# 5. Recommend alternative suppliers
# --------------------------------------------------

def recommend_suppliers(
    shipment: dict,
    max_results: int = 5,
) -> list[dict]:
    if max_results < 1:
        raise ValueError("max_results must be at least 1.")

    shipment = validate_shipment(shipment)
    component_type = shipment["component_type"]
    order_quantity = int(shipment["order_quantity"])

    suppliers = load_suppliers()
    if suppliers.empty:
        return []

    eligible = suppliers[
        (pd.to_numeric(suppliers["active"], errors="coerce").fillna(0) == 1)
        & (
            pd.to_numeric(
                suppliers["available_capacity_units"],
                errors="coerce",
            ).fillna(0)
            >= order_quantity
        )
    ].copy()

    eligible = eligible[
        eligible.apply(
            supports_component,
            axis=1,
            component_type=component_type,
        )
    ].copy()

    if eligible.empty:
        return []

    recommendations = []

    for _, supplier in eligible.iterrows():
        candidate = shipment.copy()
        candidate["supplier_location"] = supplier.get("location", "")
        candidate["supplier_on_time_rate"] = float(
            supplier.get("on_time_delivery_rate", 0.0)
        )
        candidate["supplier_quality_rate"] = float(
            supplier.get("quality_rate", 0.0)
        )
        candidate["supplier_risk_rating"] = (
            "Low"
            if candidate["supplier_on_time_rate"] >= 0.90
            else "Medium"
            if candidate["supplier_on_time_rate"] >= 0.80
            else "High"
        )

        capacity = pd.to_numeric(
            supplier.get("available_capacity_units", 0),
            errors="coerce",
        )
        capacity = float(capacity) if pd.notna(capacity) else 0.0
        candidate["supplier_capacity_utilization"] = (
            min(1.0, order_quantity / capacity) if capacity > 0 else 1.0
        )
        candidate["distance_km"] = int(
            supplier.get("distance_from_warehouse_km", 0)
        )

        try:
            prediction = predict_shipment(candidate)
        except Exception as exc:
            raise RuntimeError(
                "Unable to estimate delay risk for supplier "
                f"{supplier.get('supplier_id', 'unknown')}: {exc}"
            ) from exc

        delay_risk = float(prediction["delay_probability"])
        lead_time = float(supplier.get("average_lead_time_days", 0.0))
        quality_rate = float(supplier.get("quality_rate", 0.0))
        cost_index = float(supplier.get("unit_cost_index", 0.0))

        recommendations.append(
            {
                "supplier_id": supplier.get("supplier_id"),
                "supplier_name": supplier.get("supplier_name"),
                "location": supplier.get("location"),
                "component_type": component_type,
                "estimated_delay_probability": delay_risk,
                "estimated_delay_percent": round(delay_risk * 100, 2),
                "average_lead_time_days": lead_time,
                "quality_rate": quality_rate,
                "unit_cost_index": cost_index,
                "available_capacity_units": int(
                    supplier.get("available_capacity_units", 0)
                ),
                "on_time_delivery_rate": float(
                    supplier.get("on_time_delivery_rate", 0.0)
                ),
                "recommendation_score": None,
                "prediction_source": prediction.get(
                    "data_source",
                    "synthetic_development_data",
                ),
            }
        )

    results = pd.DataFrame(recommendations)
    if results.empty:
        return []

    results["delay_rank"] = results[
        "estimated_delay_probability"
    ].rank(pct=True)
    results["lead_time_rank"] = results[
        "average_lead_time_days"
    ].rank(pct=True)
    results["quality_rank"] = results[
        "quality_rate"
    ].rank(pct=True, ascending=False)
    results["cost_rank"] = results[
        "unit_cost_index"
    ].rank(pct=True)
    results["recommendation_score"] = (
        0.40 * results["delay_rank"]
        + 0.25 * results["lead_time_rank"]
        + 0.20 * results["quality_rank"]
        + 0.15 * results["cost_rank"]
    )

    results = results.sort_values(
        by=["recommendation_score", "estimated_delay_probability"],
        ascending=True,
    )

    output = results.head(max_results).drop(
        columns=[
            "delay_rank",
            "lead_time_rank",
            "quality_rank",
            "cost_rank",
        ]
    )

    output["recommendation_score"] = output["recommendation_score"].round(6)
    return output.to_dict(orient="records")


# --------------------------------------------------
# 6. Run a sample recommendation
# --------------------------------------------------

if __name__ == "__main__":
    sample_shipment = {
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

    results = recommend_suppliers(sample_shipment, max_results=5)

    print("=" * 65)
    print("SYNCHAIN AI - SUPPLIER RECOMMENDATIONS")
    print("=" * 65)

    if not results:
        print("\nNo eligible suppliers found.")
    else:
        for position, supplier in enumerate(results, start=1):
            print(f"\nRecommendation #{position}")
            for key, value in supplier.items():
                print(f"{key}: {value}")
