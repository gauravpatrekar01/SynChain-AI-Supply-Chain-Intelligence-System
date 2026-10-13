
import joblib
from pathlib import Path
import sys

PROJECT_ROOT = Path(r'C:\Users\Dell\OneDrive\Desktop\Syn\SynChain-AI-Supply-Chain-Intelligence-System')
MODEL_PATH = PROJECT_ROOT / 'ml-lab' / 'models' / 'delay_model.joblib'

try:
    model = joblib.load(MODEL_PATH)
    if hasattr(model, "feature_names_in_"):
        features = list(model.feature_names_in_)
        print("ACTUAL_FEATURES:" + ",".join(features))
    else:
        preprocessor = model.named_steps['preprocessor']
        actual_features = []
        for name, transformer, cols in preprocessor.transformers_:
            actual_features.extend(cols)
        print("ACTUAL_FEATURES:" + ",".join(actual_features))
except Exception as e:
    print(f"ERROR:{e}")
