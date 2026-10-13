
import joblib
from pathlib import Path

PROJECT_ROOT = Path(r'C:\Users\Dell\OneDrive\Desktop\Syn\SynChain-AI-Supply-Chain-Intelligence-System')
MODEL_PATH = PROJECT_ROOT / 'ml-lab' / 'models' / 'delay_model.joblib'

DELAY_FEATURES = [
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

try:
    model = joblib.load(MODEL_PATH)
    feature_names = list(getattr(model, "feature_names_in_", []))
    
    print(f"Model features: {feature_names}")
    print(f"Code features:  {DELAY_FEATURES}")
    print(f"Equal: {feature_names == DELAY_FEATURES}")
    
    if feature_names != DELAY_FEATURES:
        # Find differences
        model_set = set(feature_names)
        code_set = set(DELAY_FEATURES)
        print(f"Only in model: {model_set - code_set}")
        print(f"Only in code: {code_set - model_set}")
        
        # Check order
        for i, (m, c) in enumerate(zip(feature_names, DELAY_FEATURES)):
            if m != c:
                print(f"Mismatch at index {i}: model={m}, code={c}")
                break
except Exception as e:
    print(f"ERROR: {e}")
