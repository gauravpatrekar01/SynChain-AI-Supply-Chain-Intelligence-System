
import joblib
import pandas as pd
from pathlib import Path

PROJECT_ROOT = Path(r'C:\Users\Dell\OneDrive\Desktop\Syn\SynChain-AI-Supply-Chain-Intelligence-System')
MODEL_PATH = PROJECT_ROOT / 'ml-lab' / 'models' / 'delay_model.joblib'

DELAY_FEATURES = [
    "supplier_location", "component_type", "transport_mode", "distance_km",
    "weather_condition", "seasonal_rainy_period", "traffic_level",
    "supplier_risk_rating", "supplier_on_time_rate", "supplier_quality_rate",
    "supplier_capacity_utilization", "order_quantity", "inventory_at_order",
    "planned_lead_time_days", "unit_cost",
]

def test_inference():
    try:
        model = joblib.load(MODEL_PATH)
        print("Model loaded successfully.")
        
        # 1. Test with complete data
        sample_shipment = {feat: "test" if "location" in feat or "type" in feat or "mode" in feat or "condition" in feat or "level" in feat or "rating" in feat else 100 for feat in DELAY_FEATURES}
        # Fix categorical types to be strings
        for f in ["supplier_location", "component_type", "transport_mode", "weather_condition", "traffic_level", "supplier_risk_rating"]:
            sample_shipment[f] = "Unknown"
        
        input_df = pd.DataFrame([sample_shipment])
        prob = model.predict_proba(input_df)[0]
        print(f"Inference successful. Probabilities: {prob}")
        
    except Exception as e:
        print(f"Inference failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_inference()
