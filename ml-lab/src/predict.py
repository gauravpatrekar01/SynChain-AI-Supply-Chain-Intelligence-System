from pathlib import Path
from functools import lru_cache

import joblib
import pandas as pd


# --------------------------------------------------
# 1. Locate the saved model
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

MODEL_FILE = PROJECT_ROOT / "models" / "delay_model.joblib"

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


# --------------------------------------------------
# 2. Load the trained model
# --------------------------------------------------

@lru_cache(maxsize=1)
def load_model():
    if not MODEL_FILE.exists():
        raise FileNotFoundError(
            f"Trained model not found: {MODEL_FILE}. "
            "Run train.py first."
        )

    return joblib.load(MODEL_FILE)


# --------------------------------------------------
# 3. Predict shipment delay risk
# --------------------------------------------------

def predict_shipment(shipment: dict) -> dict:
    """
    Estimate shipment delay probability.

    This model is trained on synthetic development data.
    Its predictions are not validated real-world forecasts.
    """

    missing_features = [
        column
        for column in FEATURE_COLUMNS
        if column not in shipment
    ]

    if missing_features:
        raise ValueError(
            "Missing required features: "
            + ", ".join(missing_features)
        )

    # Use only the features expected by the model.
    input_data = pd.DataFrame(
        [
            {
                column: shipment[column]
                for column in FEATURE_COLUMNS
            }
        ]
    )

    model = load_model()

    probabilities = model.predict_proba(input_data)[0]

    classes = list(model.named_steps["classifier"].classes_)

    delayed_index = classes.index(1)

    delay_probability = float(
        probabilities[delayed_index]
    )

    # Initial thresholds for demonstration.
    # These must be tuned using appropriate validation data.
    if delay_probability >= 0.70:
        risk_level = "HIGH"
    elif delay_probability >= 0.40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "delay_probability": round(
            delay_probability, 4
        ),
        "delay_probability_percent": round(
            delay_probability * 100, 2
        ),
        "risk_level": risk_level,
        "model_type": "RandomForestClassifier",
        "data_source": "synthetic_development_data",
        "production_ready": False,
    }


# --------------------------------------------------
# 4. Run a sample prediction
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

    result = predict_shipment(sample_shipment)

    print("=" * 50)
    print("SYNCHAIN AI - SHIPMENT RISK PREDICTION")
    print("=" * 50)

    for key, value in result.items():
        print(f"{key}: {value}")
