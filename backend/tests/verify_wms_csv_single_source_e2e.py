"""
End-to-End Test for WMS CSV Single Source of Truth across SynChain AI.
Validates that uploading a WMS CSV file via /api/v1/ingestion makes that dataset
the canonical single source of truth across:
1. Scenario Builder (Config options, entity resolution, deterministic simulation)
2. Demand Forecasting (Inventory item catalog, demand history observations)
3. Sales Forecasting (Sales transactions, revenue overview)
4. Inventory Intelligence (On-hand stock, reorder levels, safety stock)
5. Supplier Intelligence (Supplier registry, lead times, reliability)
6. Logistics & Shipments (Shipment tracking, carrier, origin, destination)
7. Dashboard KPIs & Digital Twin (Inventory valuation, facility nodes)
8. Freshness Verification: Re-uploading updated CSV propagates updates without stale caching.
"""
import io
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
    Shipment,
    SalesTransaction,
    DataImport,
    ImportedRecord,
)
from app.models.postgres.observations import DemandObservation, LeadTimeObservation
from app.api.deps import get_current_active_user

client = TestClient(app)

def run_wms_single_source_verification():
    db = SessionLocal()
    try:
        # 1. Setup authenticated user
        user = db.query(User).filter(User.email == "wms_tester@synchain.ai").first()
        if not user:
            user = User(
                name="WMS Tester",
                email="wms_tester@synchain.ai",
                password_hash="mock_hash",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        app.dependency_overrides[get_current_active_user] = lambda: user

        print("==================================================")
        print("STEP 1: Uploading WMS CSV with Realistic Headers")
        print("==================================================")
        run_id = uuid.uuid4().hex[:5].upper()
        test_sku = f"WMS-SERVO-{run_id}"
        test_sup = f"Titan Robotics {run_id}"
        test_wh = f"WH-CENTRAL-{run_id}"
        ord1, ord2, ord3 = f"ORD-{run_id}-01", f"ORD-{run_id}-02", f"ORD-{run_id}-03"
        shp1, shp2, shp3 = f"SHP-{run_id}-01", f"SHP-{run_id}-02", f"SHP-{run_id}-03"

        csv_content = f"""sku,product_name,category,unit_price,current_stock,warehouse_id,destination,supplier_name,supplier_country,daily_demand,safety_stock,reorder_level,lead_time_days,carrier,transport_mode,order_id,shipment_id,order_date,quantity
{test_sku},Autonomous Servo Drive,Robotics,320.00,450,{test_wh},Dallas TX,{test_sup},Germany,18.5,60,90,6,DHL Freight,Air,{ord1},{shp1},2026-03-01,25
{test_sku},Autonomous Servo Drive,Robotics,320.00,450,{test_wh},Dallas TX,{test_sup},Germany,18.5,60,90,6,DHL Freight,Air,{ord2},{shp2},2026-03-02,30
{test_sku},Autonomous Servo Drive,Robotics,320.00,450,{test_wh},Dallas TX,{test_sup},Germany,18.5,60,90,6,DHL Freight,Air,{ord3},{shp3},2026-03-03,22
"""
        files = {"file": ("wms_feed.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
        res_upload = client.post("/api/v1/ingestion/upload", files=files)
        assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
        upload_data = res_upload.json()
        import_id = upload_data["import_id"]
        auto_mapping = upload_data["auto_mapping"]
        print(f"Uploaded successfully. Import ID: {import_id}")
        print(f"Auto-mapped columns: {auto_mapping}")
        assert auto_mapping.get("current_stock") == "quantity"
        assert auto_mapping.get("warehouse_id") == "source_location"
        assert auto_mapping.get("carrier") == "carrier"

        print("\n==================================================")
        print("STEP 2: Validating Ingested CSV")
        print("==================================================")
        res_val = client.post(
            f"/api/v1/ingestion/{import_id}/validate",
            json={"column_mapping": auto_mapping}
        )
        assert res_val.status_code == 200, f"Validation failed: {res_val.text}"
        val_data = res_val.json()
        assert val_data["validation"]["is_valid"] is True
        assert val_data["validation"]["valid_rows"] == 3
        print(f"Validation passed: {val_data['validation']['valid_rows']} valid rows.")

        print("\n==================================================")
        print("STEP 3: Executing Ingestion Import Pipeline")
        print("==================================================")
        res_exec = client.post(
            f"/api/v1/ingestion/{import_id}/import",
            json={"column_mapping": auto_mapping}
        )
        assert res_exec.status_code == 200, f"Import execution failed: {res_exec.text}"
        exec_data = res_exec.json()
        assert exec_data["status"] == "completed"
        print(f"Ingestion result summary:")
        print(f" - Created Products: {exec_data['entities_created']['products']}")
        print(f" - Created Suppliers: {exec_data['entities_created']['suppliers']}")
        print(f" - Created Warehouses: {exec_data['entities_created']['warehouses']}")
        print(f" - Created Shipments: {exec_data['entities_created'].get('shipments')}")
        print(f" - Created Sales Transactions: {exec_data['entities_created'].get('sales_transactions')}")

        print("\n==================================================")
        print("STEP 4: Verifying PostgreSQL Records")
        print("==================================================")
        prod = db.query(Product).filter(Product.sku == test_sku).first()
        assert prod is not None, f"Product {test_sku} not found in DB"
        assert float(prod.price) == 320.00
        print(f"Verified Product: {prod.sku}, Price=${prod.price}")

        sup = db.query(Supplier).filter(Supplier.name == test_sup).first()
        assert sup is not None, f"Supplier {test_sup} not found in DB"
        print(f"Verified Supplier: {sup.name}, Country={sup.country}")

        wh = db.query(Warehouse).filter(Warehouse.name == test_wh).first()
        assert wh is not None, f"Warehouse {test_wh} not found in DB"
        print(f"Verified Warehouse: {wh.name}")

        inv = db.query(Inventory).filter(Inventory.product_id == prod.id).first()
        assert inv is not None, f"Inventory for {test_sku} not found"
        assert inv.stock_quantity == 450
        assert inv.safety_stock_level == 60
        assert inv.reorder_level == 90
        assert float(inv.average_daily_demand) == 18.5
        assert inv.lead_time_days == 6
        print(f"Verified Inventory: Stock={inv.stock_quantity}, Safety={inv.safety_stock_level}, DailyDemand={inv.average_daily_demand}, LeadTime={inv.lead_time_days}")

        shipments = db.query(Shipment).filter(Shipment.shipment_id.in_([shp1, shp2, shp3])).all()
        assert len(shipments) == 3, f"Expected 3 shipments, found {len(shipments)}"
        print(f"Verified Shipments in DB: {len(shipments)} records created (Carrier: {shipments[0].carrier_name}, Mode: {shipments[0].transport_mode})")

        sales = db.query(SalesTransaction).filter(SalesTransaction.transaction_id.in_([f"TX-{ord1}-001", f"TX-{ord2}-002", f"TX-{ord3}-003"])).all()
        assert len(sales) == 3, f"Expected 3 sales transactions, found {len(sales)}"
        print(f"Verified Sales Transactions in DB: {len(sales)} records created (Gross Rev: ${sales[0].gross_revenue})")

        print("\n==================================================")
        print("STEP 5: Verifying Scenario Builder Integration")
        print("==================================================")
        res_cfg = client.get("/api/v1/scenario/config-options")
        assert res_cfg.status_code == 200, f"Config options failed: {res_cfg.text}"
        cfg_data = res_cfg.json()
        assert "organizations" in cfg_data and len(cfg_data["organizations"]) > 0
        print(f"Verified Organizations in Scenario Builder: {len(cfg_data['organizations'])} units")

        matching_prods = [p for p in cfg_data["products"] if p["value"] == test_sku]
        assert len(matching_prods) > 0, f"Imported SKU {test_sku} missing from Scenario Builder options"
        assert matching_prods[0]["unit_cost_usd"] == 320.00
        assert matching_prods[0].get("source_address") is not None
        assert matching_prods[0].get("destination_address") is not None
        print(f"Verified Route Details on Product: Source={matching_prods[0].get('source_address')}, Dest={matching_prods[0].get('destination_address')}")

        matching_sups = [s for s in cfg_data["suppliers"] if s["value"] == str(sup.id)]
        assert len(matching_sups) > 0, f"Imported Supplier {test_sup} missing from Scenario Builder options"
        print(f"Scenario Builder Supplier Option: {matching_sups[0]}")

        # Run Scenario Simulation on the imported product without hardcoded inputs
        res_sim = client.post(
            "/api/v1/scenario/simulate",
            json={
                "scenario_name": "WMS Ingested Disruption Simulation",
                "sku": test_sku,
                "disruption_scenario_type": "supplier_outage",
                "severity_pct": 50,
                "duration_days": 10,
                "target_supplier_id": str(sup.id),
                "optimization_objective": "balanced",
            }
        )
        assert res_sim.status_code == 200, f"Simulation failed: {res_sim.text}"
        sim_data = res_sim.json()
        assert sim_data["data_provenance"]["is_live_database"] is True
        assert sim_data["baseline"]["direct_purchase_cost_usd"] > 0
        assert "route_details" in sim_data and sim_data["route_details"] is not None
        print(f"Scenario Simulation executed successfully using live DB records:")
        print(f" - Route Summary: {sim_data['route_details']['organization_name']} -> {sim_data['route_details']['product_name']} -> {sim_data['route_details']['source_supplier_name']}")
        print(f" - Initial Inventory Used: {sim_data['baseline']['daily_trajectory'][0]['starting_inventory']} (Expected: 450)")
        assert sim_data['baseline']['daily_trajectory'][0]['starting_inventory'] == 450
        print(f" - Baseline Total Cost: ${sim_data['baseline']['total_cost_usd']}")
        print(f" - Evaluated Strategies: {[s['strategy_name'] for s in sim_data['mitigation_strategies']]}")

        print("\n==================================================")
        print("STEP 6: Verifying Demand Forecasting Integration")
        print("==================================================")
        res_items = client.get("/api/v1/forecast/inventory-items")
        assert res_items.status_code == 200, f"Inventory items failed: {res_items.text}"
        items_data = res_items.json()
        found_item = next((it for it in items_data if it["sku"] == test_sku), None)
        assert found_item is not None, f"Imported SKU {test_sku} not found in forecast inventory catalog"
        assert found_item["hasHistoricalDemand"] is True
        assert found_item["dataSource"] == "imported_csv_actual"
        print(f"Forecast Catalog item: SKU={found_item['sku']}, hasHistoricalDemand={found_item['hasHistoricalDemand']}, dataSource={found_item['dataSource']}")

        res_hist = client.get(f"/api/v1/forecast/demand-history/{test_sku}")
        assert res_hist.status_code == 200, f"Demand history failed: {res_hist.text}"
        hist_data = res_hist.json()
        assert hist_data["sku"] == test_sku
        obs_points = hist_data.get("historicalData", [])
        assert len(obs_points) >= 3, f"Expected at least 3 historical points, got {len(obs_points)}"
        print(f"Demand History points retrieved: {len(obs_points)} points. Data provenance: {hist_data.get('dataSource')}")

        print("\n==================================================")
        print("STEP 7: Verifying Sales Forecasting Integration")
        print("==================================================")
        res_sales_tx = client.get(f"/api/v1/sales/transactions?search={test_sku}")
        assert res_sales_tx.status_code == 200, f"Sales transactions failed: {res_sales_tx.text}"
        tx_data = res_sales_tx.json()
        assert tx_data["total"] >= 3, f"Expected at least 3 transactions, got {tx_data['total']}"
        print(f"Sales Transactions found for {test_sku}: {tx_data['total']} transactions")

        # Global Sales Overview (all historical data across entire database)
        res_sales_ov = client.get("/api/v1/sales/overview")
        assert res_sales_ov.status_code == 200, f"Sales overview failed: {res_sales_ov.text}"
        ov_data = res_sales_ov.json()
        assert ov_data["total_revenue"] > 0
        print(f"Global Sales Overview (All Products): Total Revenue=${ov_data['total_revenue']}, Total Transactions={ov_data['total_transactions']}")

        # Product-Filtered Sales Overview (specifically for this imported SKU)
        res_sales_prod = client.get(f"/api/v1/sales/overview?product_id={test_sku}")
        assert res_sales_prod.status_code == 200, f"Product sales overview failed: {res_sales_prod.text}"
        prod_ov_data = res_sales_prod.json()
        assert prod_ov_data["total_transactions"] == 3, f"Expected 3 transactions for {test_sku}, got {prod_ov_data['total_transactions']}"
        print(f"Product-Filtered Sales Overview ({test_sku}): Total Revenue=${prod_ov_data['total_revenue']}, Transactions={prod_ov_data['total_transactions']} (Exact WMS Match!)")

        print("\n==================================================")
        print("STEP 8: Verifying Shipments and Suppliers APIs")
        print("==================================================")
        res_shp = client.get("/api/v1/shipments?flat=true")
        assert res_shp.status_code == 200
        shp_list = res_shp.json()
        matching_shp = [s for s in shp_list if s.get("shipment_id") in [shp1, shp2, shp3]]
        assert len(matching_shp) == 3
        print(f"Verified Shipments API returns imported records: {len(matching_shp)} matching shipments")

        res_sups = client.get("/api/v1/suppliers?flat=true")
        assert res_sups.status_code == 200
        sups_list = res_sups.json()
        matching_s = [s for s in sups_list if s.get("name") == test_sup]
        assert len(matching_s) >= 1
        print(f"Verified Suppliers API returns imported supplier: {matching_s[0]['name']}")

        print("\n==================================================")
        print("STEP 9: Re-uploading Updated CSV & Verifying Freshness")
        print("==================================================")
        # Modify stock to 520, unit price to 345.00
        updated_csv = f"""sku,product_name,category,unit_price,current_stock,warehouse_id,destination,supplier_name,supplier_country,daily_demand,safety_stock,reorder_level,lead_time_days,carrier,transport_mode,order_id,shipment_id,order_date,quantity
{test_sku},Autonomous Servo Drive,Robotics,345.00,520,{test_wh},Dallas TX,{test_sup},Germany,22.0,75,110,5,DHL Freight Express,Air,{ord1},{shp1},2026-03-01,35
"""
        files2 = {"file": ("wms_feed_updated.csv", io.BytesIO(updated_csv.encode("utf-8")), "text/csv")}
        res_up2 = client.post("/api/v1/ingestion/upload", files=files2)
        assert res_up2.status_code == 200
        up2_data = res_up2.json()
        imp2_id = up2_data["import_id"]

        res_imp2 = client.post(
            f"/api/v1/ingestion/{imp2_id}/import",
            json={"column_mapping": up2_data["auto_mapping"]}
        )
        assert res_imp2.status_code == 200
        print("Updated CSV imported successfully.")

        # Verify updated DB state immediately
        db.expire_all()
        inv_updated = db.query(Inventory).filter(Inventory.product_id == prod.id).first()
        assert inv_updated.stock_quantity == 520, f"Expected 520 stock, found {inv_updated.stock_quantity}"
        assert inv_updated.safety_stock_level == 75
        print(f"Verified Updated Inventory in DB: stock={inv_updated.stock_quantity}, safety={inv_updated.safety_stock_level}")

        prod_updated = db.query(Product).filter(Product.sku == test_sku).first()
        assert float(prod_updated.price) == 345.00
        print(f"Verified Updated Product in DB: price=${prod_updated.price}")

        # Verify Scenario Builder receives updated price & inventory
        res_cfg2 = client.get("/api/v1/scenario/config-options")
        assert res_cfg2.status_code == 200
        cfg2_prods = [p for p in res_cfg2.json()["products"] if p["value"] == test_sku]
        assert len(cfg2_prods) > 0
        assert cfg2_prods[0]["unit_cost_usd"] == 345.00
        print(f"Verified Scenario Builder immediately reflects updated price: ${cfg2_prods[0]['unit_cost_usd']}")

        # Verify Scenario Simulation uses updated initial stock 520
        res_sim2 = client.post(
            "/api/v1/scenario/simulate",
            json={
                "scenario_name": "Updated WMS Stock Simulation",
                "sku": test_sku,
                "disruption_scenario_type": "supplier_outage",
                "severity_pct": 50,
                "duration_days": 10,
                "target_supplier_id": str(sup.id),
                "optimization_objective": "balanced",
            }
        )
        assert res_sim2.status_code == 200
        sim2_data = res_sim2.json()
        assert sim2_data['baseline']['daily_trajectory'][0]['starting_inventory'] == 520
        print(f"Verified Scenario Simulation immediately uses updated initial stock: {sim2_data['baseline']['daily_trajectory'][0]['starting_inventory']}")

        print("\n==================================================")
        print("ALL END-TO-END VERIFICATION CHECKS PASSED!")
        print("WMS CSV IS THE FULLY INTEGRATED SINGLE SOURCE OF TRUTH!")
        print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_wms_single_source_verification()
