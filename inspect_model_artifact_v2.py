
import joblib
from pathlib import Path
import sys

PROJECT_ROOT = Path(r'C:\Users\Dell\OneDrive\Desktop\Syn\SynChain-AI-Supply-Chain-Intelligence-System')
MODEL_PATH = PROJECT_ROOT / 'ml-lab' / 'models' / 'delay_model.joblib'

try:
    model = joblib.load(MODEL_PATH)
    # Check for feature_names_in_ which is standard for scikit-learn Pipelines/Models since 1.0
    if hasattr(model, "feature_names_in_"):
        features = list(model.feature_names_in_)
        print("FEATURES:" + ",".join(features))
    else:
        # Fallback to inspecting preprocessor
        preprocessor = model.named_steps['preprocessor']
        actual_features = []
        for name, transformer, cols in preprocessor.transformers_:
            actual_features.extend(cols)
        print("FEATURES:" + ",".join(actual_features))
except Exception as e:
    print(f"ERROR:{e}")
