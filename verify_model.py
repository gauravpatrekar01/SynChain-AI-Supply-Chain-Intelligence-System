
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

model_path = Path('ml-lab/models/delay_model.joblib')
try:
    model = joblib.load(model_path)
    print('LOAD_SUCCESS')
    # Check feature names
    if hasattr(model, 'feature_names_in_'):
        print(f'FEATURES: {model.feature_names_in_}')
    else:
        print('NO_FEATURE_NAMES')
except Exception as e:
    print(f'LOAD_FAILED: {e}')
