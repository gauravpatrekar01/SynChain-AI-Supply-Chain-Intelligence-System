
import sys
import os
from pathlib import Path
import io

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

def test_supplier_master_workflow():
    user_id = "test_user_master"
    
    # 1. Valid Supplier Master Data
    # Note: component_types uses semicolon as separator based on ml-lab/src/recommend_supplier.py:112
    master_content = (
        "supplier_id,supplier_name,location,component_types,supplier_risk_rating,"
        "average_lead_time_days,on_time_delivery_rate,quality_rate,unit_cost_index,"
        "available_capacity_units,distance_from_warehouse_km,active\n"
        "S_MASTER_1,Global Logistics,Pune,Battery;Sensor,Low,5,0.95,0.98,1.0,5000,100,1\n"
        "S_MASTER_2,FastShip,Mumbai,Battery,Medium,8,0.88,0.92,1.1,2000,50,1\n"
    )
    
    # 2. Valid ERP Data (must match S_MASTER_1 or S_MASTER_2 by component_type)
    erp_content = (
        "supplier_id,supplier_name,product_id,order_id,lead_time_days,unit_cost,order_quantity,"
        "supplier_location,component_type,transport_mode,distance_km,weather_condition,"
        "seasonal_rainy_period,traffic_level,supplier_risk_rating,supplier_on_time_rate,"
        "supplier_quality_rate,supplier_capacity_utilization,inventory_at_order,"
        "planned_lead_time_days,unit_cost_index,available_capacity_units,distance_from_warehouse_km,active\n"
        "S_ORIGINAL,Original Supplier,P1,O1,25,100,500,Pune,Battery,Road,450,Rain,1,High,Medium,0.85,0.9,0.8,200,5,1.0,1000,100,1\n"
    )

    try:
        print("\n--- Testing Supplier Master Upload ---")
        res_master = IntelligenceService.upload_dataset(user_id, 'supplier_master', MockUploadFile('master.csv', master_content))
        print(f"Supplier Master Upload: {res_master['success']}")
        
        print("\n--- Testing ERP Upload ---")
        res_erp = IntelligenceService.upload_dataset(user_id, 'erp', MockUploadFile('erp.csv', erp_content))
        print(f"ERP Upload: {res_erp['success']}")
        
        print("\n--- Running Analysis ---")
        analysis = IntelligenceService.analyze_for_user(user_id)
        print(f"Analysis Status: {analysis['analysis_status']}")
        
        ml_results = analysis.get('ml_analysis', {})
        recs = ml_results.get('supplier_recommendations', {})
        
        print(f"Recommendations Status: {recs.get('status')}")
        if recs.get('status') == 'completed':
            print(f"Number of Recommendations: {len(recs.get('recommendations', []))}")
            for i, r in enumerate(recs.get('recommendations', []), 1):
                print(f"  {i}. {r['supplier_name']} (Score: {r['recommendation_score']})")
        else:
            print(f"Recommendations failed or skipped: {recs.get('message')}")
            if 'missing_fields' in recs:
                print(f"Missing fields: {recs['missing_fields']}")

    except Exception as e:
        print(f"Workflow failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_supplier_master_workflow()
