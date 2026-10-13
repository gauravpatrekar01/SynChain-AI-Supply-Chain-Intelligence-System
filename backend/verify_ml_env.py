
import logging
import sys
from pathlib import Path

# Mock the environment to avoid needing a full FastAPI app
import os
os.environ['DATABASE_URL'] = 'postgresql://user:pass@localhost/db'

try:
    # We try to import the adapter directly.
    # It should be in backend/app/services/intelligence/ml_analysis.py
    # Since we are running from /backend, we can use:
    from app.services.intelligence.ml_analysis import run_ml_analysis
    print('ADAPTER_LOADED')
    
    # Try to trigger the specific component loaders
    import app.services.intelligence.ml_analysis as ml_analysis
    
    print('Testing DistilBERT load...')
    try:
        ml_analysis._get_text_components()
        print('DISTILBERT_LOAD_SUCCESS')
    except Exception as e:
        print(f'DISTILBERT_LOAD_FAILED: {e}')
        
    print('Testing Chronos load...')
    try:
        ml_analysis._get_chronos_components()
        print('CHRONOS_LOAD_SUCCESS')
    except Exception as e:
        print(f'CHRONOS_LOAD_FAILED: {e}')
        
except Exception as e:
    print(f'ORCHESTRATION_LOAD_FAILED: {e}')
