
import sys
import os
from pathlib import Path
import io
import pandas as pd

# Setup paths to import from app
sys.path.append(str(Path('.').absolute() / 'backend'))

from app.services.intelligence.intelligence_service import IntelligenceService
from fastapi import UploadFile

class MockUploadFile:
    def __init__(self, filename, content):
        self.filename = filename
        self.file = io.BytesIO(content.encode('utf-8'))
    def read(self, size=-1):
        return self.file.read(size)

def test_workflow():
    user_id = "test_user_complete"
    
    # Sample data that contains all required features for the RF model
    erp_content = 'supplier_id,supplier_name,product_id,order_id,lead_time_days,unit_cost,order_quantity,supplier_location,component_type,transport_mode,distance_km,weather_condition,seasonal_rainy_period,traffic_level,supplier_risk_rating,supplier_on_time_rate,supplier_quality_rate,supplier_capacity_utilization,inventory_at_order,planned_lead_time_days,unit_cost_index,available_capacity_units,distance_from_warehouse_km,active\nS1,Supplier A,P1,O1,25,100,500,Pune,Battery,Road,450,Rain,1,High,Medium,0.85,0.9,0.8,200,5,1.0,1000,100,1\n'
    wms_content = 'warehouse_id,product_id,current_stock,reorder_level,daily_demand,observation_date,scenario_horizon_days,simulation_shipment_quantity,baseline_lead_time_days,mitigated_lead_time_days\nW1,P1,100,200,50,2026-10-01,30,1000,25,15\n'
    csr_content = 'supplier_id,supplier_name,emissions_score,compliance_score\nS1,Supplier A,40,60\n'

    try:
        print("\n--- Uploading Datasets ---")
        IntelligenceService.upload_dataset(user_id, 'erp', MockUploadFile('erp.csv', erp_content))
        IntelligenceService.upload_dataset(user_id, 'wms', MockUploadFile('wms.csv', wms_content))
        IntelligenceService.upload_dataset(user_id, 'csr', MockUploadFile('csr.csv', csr_content))
        print("Uploads completed.")

        print("\n--- Running Analysis ---")
        result = IntelligenceService.analyze_for_user(user_id)
        
        print(f"Analysis Status: {result['analysis_status']}")
        print(f"Total Risks: {result['summary']['total_risks']}")
        
        ml_results = result.get('ml_analysis', {})
        for component, res in ml_results.items():
            print(f"{component}: {res['status']}")
            if res['status'] == 'completed':
                if 'predictions' in res:
                    print(f"  - Predictions: {len(res['predictions'])}")
                if 'scenarios' in res:
                    print(f"  - Scenarios: {list(res['scenarios'].keys())}")
        
        # Verify simulation
        sim = ml_results.get('simulation', {})
        if sim.get('status') == 'completed':
            print("Simulation verification: SUCCESS")
        else:
            print(f"Simulation verification: FAILED ({sim.get('status')})")

    except Exception as e:
        print(f"Workflow failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_workflow()
