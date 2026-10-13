
import sys
import os
from pathlib import Path
from unittest.mock import MagicMock

# Mock joblib before any other imports
mock_joblib = MagicMock()
sys.modules['joblib'] = mock_joblib
# Mock pandas as well just in case
mock_pd = MagicMock()
sys.modules['pandas'] = mock_pd

# Setup paths to import from app
sys.path.append(str(Path('.').absolute() / 'backend'))

try:
    from app.services.intelligence.intelligence_service import IntelligenceService
    from fastapi import UploadFile
    import io

    class MockUploadFile:
        def __init__(self, filename, content):
            self.filename = filename
            self.file = io.BytesIO(content.encode('utf-8'))
        def read(self, size=-1):
            return self.file.read(size)

    def test_pipeline():
        user_id = "test_user_123"
        
        print("\n--- Testing Uploads ---")
        try:
            with open('sample_erp.csv', 'r') as f:
                erp_file = MockUploadFile('sample_erp.csv', f.read())
                res_erp = IntelligenceService.upload_dataset(user_id, 'erp', erp_file)
                print(f"ERP Upload: {res_erp['success']}")
                
            with open('sample_wms.csv', 'r') as f:
                wms_file = MockUploadFile('sample_wms.csv', f.read())
                res_wms = IntelligenceService.upload_dataset(user_id, 'wms', wms_file)
                print(f"WMS Upload: {res_wms['success']}")
                
            with open('sample_csr.csv', 'r') as f:
                csr_file = MockUploadFile('sample_csr.csv', f.read())
                res_csr = IntelligenceService.upload_dataset(user_id, 'csr', csr_file)
                print(f"CSR Upload: {res_csr['success']}")
                
            print("\n--- Testing Analysis ---")
            analysis = IntelligenceService.analyze_for_user(user_id)
            print(f"Analysis Status: {analysis['analysis_status']}")
            print(f"Total Risks Found: {analysis['summary']['total_risks']}")
            
            print("\n--- ML Component Status ---")
            ml_results = analysis.get('ml_analysis', {})
            for component, result in ml_results.items():
                print(f"{component}: {result['status']}")

        except Exception as e:
            print(f"Pipeline failed: {e}")
            import traceback
            traceback.print_exc()

    if __name__ == '__main__':
        test_pipeline()

except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
