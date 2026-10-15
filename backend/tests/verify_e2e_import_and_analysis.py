"""End-to-End verification script for CSV import and downstream analysis data consistency.
Tests CSV parsing, validation, batch database persistence, count verification,
and downstream analysis consumption (digital twin, inventory metrics, demand history, risk matrix).
"""
import io
import sys
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.postgres.models import (
    User,
    Product,
    Warehouse,
    Supplier,
    Inventory,
    Order,
    DataImport,
    ImportedRecord,
)
from app.models.postgres.observations import DemandObservation, LeadTimeObservation
from app.api.deps import get_current_active_user

client = TestClient(app)

def run_e2e_verification():
    db = SessionLocal()
    try:
        # 1. Setup authenticated user
        user = db.query(User).filter(User.email == "e2e_admin@synchain.ai").first()
        if not user:
            user = User(
                name="E2E Admin",
                email="e2e_admin@synchain.ai",
                password_hash="mock_hash",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        app.dependency_overrides[get_current_active_user] = lambda: user

        print("=== Step 1: Uploading CSV ===")
        # Build multi-row CSV covering inventory, orders, demand observations, and lead times
        csv_content = """sku,product_name,category,unit_price,warehouse,location,supplier_name,supplier_country,stock_quantity,safety_stock,reorder_level,reserved_qty,incoming_qty,lead_time_days,order_id,order_status,order_quantity,unit_cost,order_date,demand_date,demand_quantity,receipt_id,actual_delivery_date
E2E-PROD-001,High-Precision Servo,Robotics,249.50,WH-NORTH,Chicago IL,Apex Motion,USA,150,30,50,10,25,7,ORD-E2E-1001,shipped,20,180.00,2026-03-01,2026-03-01,15,REC-E2E-001,2026-03-08
E2E-PROD-001,High-Precision Servo,Robotics,249.50,WH-NORTH,Chicago IL,Apex Motion,USA,150,30,50,10,25,7,ORD-E2E-1002,delivered,25,180.00,2026-03-02,2026-03-02,18,REC-E2E-002,2026-03-09
E2E-PROD-001,High-Precision Servo,Robotics,249.50,WH-NORTH,Chicago IL,Apex Motion,USA,150,30,50,10,25,7,ORD-E2E-1003,pending,15,180.00,2026-03-03,2026-03-03,22,,
E2E-PROD-002,Lithium Battery Pack,Energy,450.00,WH-SOUTH,Austin TX,Voltaic Energy,USA,80,20,35,5,15,10,ORD-E2E-2001,processing,30,320.00,2026-03-01,2026-03-01,10,REC-E2E-003,2026-03-11
E2E-PROD-002,Lithium Battery Pack,Energy,450.00,WH-SOUTH,Austin TX,Voltaic Energy,USA,80,20,35,5,15,10,ORD-E2E-2002,delivered,12,320.00,2026-03-02,2026-03-02,14,REC-E2E-004,2026-03-12
"""
        files = {"file": ("e2e_supply_chain.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
        res_upload = client.post("/api/v1/ingestion/upload", files=files)
        print(f"Upload Response: {res_upload.status_code}")
        assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
        upload_data = res_upload.json()
        import_id = upload_data["import_id"]
        auto_mapping = upload_data["auto_mapping"]
        print(f"Import ID: {import_id}, Detected Rows: {upload_data['rows_detected']}")
        assert upload_data["rows_detected"] == 5

        print("\n=== Step 2: Validating CSV Data ===")
        res_val = client.post(
            f"/api/v1/ingestion/{import_id}/validate",
            json={"column_mapping": auto_mapping}
        )
        print(f"Validation Response: {res_val.status_code}")
        assert res_val.status_code == 200, f"Validation failed: {res_val.text}"
        val_data = res_val.json()
        print(f"Validation Result: is_valid={val_data['validation']['is_valid']}, valid_rows={val_data['validation']['valid_rows']}")
        assert val_data["validation"]["is_valid"] is True
        assert val_data["validation"]["valid_rows"] == 5

        print("\n=== Step 3: Executing Database Import ===")
        res_exec = client.post(
            f"/api/v1/ingestion/{import_id}/import",
            json={"column_mapping": auto_mapping}
        )
        print(f"Execution Response: {res_exec.status_code}")
        assert res_exec.status_code == 200, f"Execution failed: {res_exec.text}"
        exec_data = res_exec.json()
        print(f"Execution Status: {exec_data['status']}, Processed Count: {exec_data['rows_processed']}")
        assert exec_data["status"] == "completed"
        assert exec_data["rows_processed"] == 5

        print("\n=== Step 4: Verifying Database Persistence & Counts ===")
        # Verify Product persistence
        p1 = db.query(Product).filter(Product.sku == "E2E-PROD-001").first()
        p2 = db.query(Product).filter(Product.sku == "E2E-PROD-002").first()
        assert p1 is not None, "Product E2E-PROD-001 not persisted"
        assert p2 is not None, "Product E2E-PROD-002 not persisted"
        print(f"Products persisted: {p1.sku} (${p1.price}), {p2.sku} (${p2.price})")

        # Verify Warehouse persistence
        wh_north = db.query(Warehouse).filter(Warehouse.name == "WH-NORTH").first()
        wh_south = db.query(Warehouse).filter(Warehouse.name == "WH-SOUTH").first()
        assert wh_north is not None, "Warehouse WH-NORTH not persisted"
        assert wh_south is not None, "Warehouse WH-SOUTH not persisted"
        print(f"Warehouses persisted: {wh_north.name}, {wh_south.name}")

        # Verify Supplier persistence
        sup1 = db.query(Supplier).filter(Supplier.name == "Apex Motion").first()
        sup2 = db.query(Supplier).filter(Supplier.name == "Voltaic Energy").first()
        assert sup1 is not None, "Supplier Apex Motion not persisted"
        assert sup2 is not None, "Supplier Voltaic Energy not persisted"
        print(f"Suppliers persisted: {sup1.name}, {sup2.name}")

        # Verify Inventory persistence with safety stock and reorder levels
        inv1 = db.query(Inventory).filter(
            Inventory.product_id == p1.id,
            Inventory.warehouse_id == wh_north.id
        ).first()
        assert inv1 is not None, "Inventory for E2E-PROD-001 not persisted"
        assert inv1.stock_quantity == 150
        assert inv1.safety_stock_level == 30
        assert inv1.reorder_level == 50
        print(f"Inventory verified: stock={inv1.stock_quantity}, safety={inv1.safety_stock_level}, reorder={inv1.reorder_level}")

        # Verify Orders persistence
        orders = db.query(Order).filter(Order.external_id.in_(["ORD-E2E-1001", "ORD-E2E-1002", "ORD-E2E-1003"])).all()
        assert len(orders) == 3, f"Expected 3 orders for E2E-PROD-001, found {len(orders)}"
        print(f"Orders persisted for E2E-PROD-001: {len(orders)}")

        # Verify Demand Observations persistence
        obs = db.query(DemandObservation).filter(DemandObservation.product_id == p1.id).all()
        assert len(obs) >= 3, f"Expected at least 3 demand observations, found {len(obs)}"
        print(f"Demand observations persisted: {len(obs)}")

        # Verify Lead Time Observations persistence
        lead_obs = db.query(LeadTimeObservation).filter(LeadTimeObservation.product_id == p1.id).all()
        assert len(lead_obs) >= 2, f"Expected at least 2 lead time observations, found {len(lead_obs)}"
        print(f"Lead time observations persisted: {len(lead_obs)}")

        # Verify ImportedRecord count matches 5
        records_count = db.query(ImportedRecord).filter(ImportedRecord.import_id == import_id).count()
        assert records_count == 5, f"Expected 5 ImportedRecord rows, found {records_count}"
        print(f"ImportedRecord count verified: {records_count}")

        print("\n=== Step 5: Testing Downstream Analysis Data Consistency ===")
        # 5a: Dashboard KPIs
        res_ops = client.get("/api/v1/dashboard/kpis")
        assert res_ops.status_code == 200, f"Dashboard KPIs failed: {res_ops.text}"
        ops_data = res_ops.json()
        assert "globalRiskIndex" in ops_data
        assert "totalInventoryValueUsd" in ops_data
        print(f"Dashboard KPIs verified: totalInventoryValueUsd={ops_data['totalInventoryValueUsd']}")

        # 5b: Digital Twin
        res_dt = client.get("/api/v1/digital-twin")
        assert res_dt.status_code == 200, f"Digital twin failed: {res_dt.text}"
        dt_data = res_dt.json()
        assert "nodes" in dt_data
        assert "edges" in dt_data
        print(f"Digital twin verified: nodes={len(dt_data['nodes'])}, edges={len(dt_data['edges'])}")

        # 5c: Demand History Route
        res_dh = client.get(f"/api/v1/forecast/demand-history/{p1.sku}")
        assert res_dh.status_code == 200, f"Demand history failed: {res_dh.text}"
        dh_data = res_dh.json()
        assert dh_data["sku"] == p1.sku
        h_points = dh_data.get("historicalData") or dh_data.get("history", [])
        assert len(h_points) >= 3
        print(f"Demand history verified for {p1.sku}: {len(h_points)} observations")

        # 5d: Risk Matrix
        res_rm = client.get("/api/v1/risk-matrix")
        assert res_rm.status_code == 200, f"Risk matrix failed: {res_rm.text}"
        rm_data = res_rm.json()
        assert isinstance(rm_data, list)
        assert len(rm_data) > 0
        print(f"Risk matrix verified: items={len(rm_data)}, top risk={rm_data[0].get('title')}")

        # 5e: Inventory API
        res_inv = client.get("/api/v1/inventory")
        assert res_inv.status_code == 200, f"Inventory API failed: {res_inv.text}"
        inv_list = res_inv.json()
        assert len(inv_list) >= 2
        print(f"Inventory API verified: {len(inv_list)} inventory records returned")

        # 5f: Dashboard Overview
        res_dash = client.get("/api/v1/dashboard/overview")
        assert res_dash.status_code == 200, f"Dashboard overview failed: {res_dash.text}"
        dash_data = res_dash.json()
        assert dash_data["productsCount"] >= 2
        assert dash_data["warehousesCount"] >= 2
        assert dash_data["suppliersCount"] >= 2
        print(f"Dashboard overview verified: products={dash_data['productsCount']}, suppliers={dash_data['suppliersCount']}, warehouses={dash_data['warehousesCount']}")

        print("\nALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)!")

    finally:
        # Cleanup E2E test data
        try:
            db.query(ImportedRecord).filter(ImportedRecord.import_id == import_id).delete()
            db.query(DataImport).filter(DataImport.id == import_id).delete()
            order_ids = [
                row[0] for row in db.query(Order.id).filter(
                    Order.external_id.in_(["ORD-E2E-1001", "ORD-E2E-1002", "ORD-E2E-1003", "ORD-E2E-2001", "ORD-E2E-2002"])
                ).all()
            ]
            if order_ids:
                from app.models.postgres.models import OrderItem
                db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
                db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
            if 'p1' in locals() and p1:
                db.query(DemandObservation).filter(DemandObservation.product_id == p1.id).delete()
                db.query(LeadTimeObservation).filter(LeadTimeObservation.product_id == p1.id).delete()
                db.query(Inventory).filter(Inventory.product_id == p1.id).delete()
                db.delete(p1)
            if 'p2' in locals() and p2:
                db.query(DemandObservation).filter(DemandObservation.product_id == p2.id).delete()
                db.query(LeadTimeObservation).filter(LeadTimeObservation.product_id == p2.id).delete()
                db.query(Inventory).filter(Inventory.product_id == p2.id).delete()
                db.delete(p2)
            if 'wh_north' in locals() and wh_north:
                db.delete(wh_north)
            if 'wh_south' in locals() and wh_south:
                db.delete(wh_south)
            if 'sup1' in locals() and sup1:
                db.delete(sup1)
            if 'sup2' in locals() and sup2:
                db.delete(sup2)
            if 'user' in locals() and user:
                db.delete(user)
            db.commit()
            print("Cleaned up temporary E2E test records cleanly.")
        except Exception as e:
            print(f"Teardown cleanup error (non-fatal): {e}")
            db.rollback()
        finally:
            db.close()
            app.dependency_overrides.clear()

if __name__ == "__main__":
    run_e2e_verification()
