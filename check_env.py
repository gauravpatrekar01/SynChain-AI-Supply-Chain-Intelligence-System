
import sys
try:
    import pandas
    import joblib
    print("SUCCESS: pandas and joblib are available")
except ImportError as e:
    print(f"FAILURE: {e}")
print(f"Python Path: {sys.executable}")
