
import sys
try:
    import pandas as pd
    import joblib
    import sklearn
    print("IMPORT_SUCCESS: pandas, joblib, sklearn are available")
except ImportError as e:
    print(f"IMPORT_FAILURE: {e}")
    sys.exit(1)

from pathlib import Path
PROJECT_ROOT = Path(r'C:\Users\Dell\OneDrive\Desktop\Syn\SynChain-AI-Supply-Chain-Intelligence-System')
MODEL_PATH = PROJECT_ROOT / 'ml-lab' / 'models' / 'delay_model.joblib'

try:
    model = joblib.load(MODEL_PATH)
    print("MODEL_LOAD_SUCCESS")
    
    # Real prediction
    DELAY_FEATURES = [
        "supplier_location", "component_type", "transport_mode", "distance_km",
        "weather_condition", "seasonal_rainy_period", "traffic_level",
        "supplier_risk_rating", "supplier_on_time_rate", "supplier_quality_rate",
        "supplier_capacity_utilization", "order_quantity", "inventory_at_order",
        "planned_lead_time_days", "unit_cost",
    ]
    
    sample_shipment = {feat: "Unknown" if "location" in feat or "type" in feat or "mode" in feat or "condition" in feat or "level" in feat or "rating" in feat else 100 for feat in DELAY_FEATURES}
    input_df = pd.DataFrame([sample_shipment])
    prob = model.predict_proba(input_df)[0]
    print(f"PREDICTION_SUCCESS: {prob}")
except Exception as e:
    print(f"RUNTIME_FAILURE: {e}")
    sys.exit(1)
