
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

model_path = Path('ml-lab/models/delay_model.joblib')
try:
    model = joblib.load(model_path)
    # Sample input based on DELAY_FEATURES seen in intelligence_service.py
    sample = {
        'supplier_location': 'Pune',
        'component_type': 'Battery',
        'transport_mode': 'Road',
        'distance_km': 450,
        'weather_condition': 'Rain',
        'seasonal_rainy_period': 1,
        'traffic_level': 'High',
        'supplier_risk_rating': 'Medium',
        'supplier_on_time_rate': 0.82,
        'supplier_quality_rate': 0.91,
        'supplier_capacity_utilization': 0.85,
        'order_quantity': 500,
        'inventory_at_order': 200,
        'planned_lead_time_days': 5,
        'unit_cost': 250.0,
    }
    df = pd.DataFrame([sample])
    prob = model.predict_proba(df)[0]
    print(f'PRED_SUCCESS: {prob}')
except Exception as e:
    print(f'PRED_FAILED: {e}')
