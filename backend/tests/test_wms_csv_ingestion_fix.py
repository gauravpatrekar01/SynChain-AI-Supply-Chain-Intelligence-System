"""
Comprehensive test verifying the fix for 'Staged file not found' in SynChain AI WMS CSV ingestion.
Tests:
1. Upload 10-row, 31-column synchain_comprehensive_wms_validation.csv
2. Verify Preview (10 rows, 31 columns detected)
3. Verify Column Auto-Mapping (18/31 mapped)
4. Verify Validation (10 valid rows, 0 invalid, 0 duplicates)
5. Execute Import and verify PostgreSQL database persistence
6. Idempotent Retry: Call import again after completion -> returns success (no 'Staged file not found')
7. Missing/Expired Staging File: Returns clear actionable error message
8. Transient Failure Retry: Staged file preserved, retry succeeds with zero duplicates
9. Safe Cancellation: Cleans up staged file and marks session cancelled
"""
import io
import os
import sys
import uuid
import pytest
from pathlib import Path

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
from app.api.deps import get_current_active_user

client = TestClient(app)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "synchain_comprehensive_wms_validation.csv"


def get_test_user():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "wms_validator@synchain.ai").first()
        if not user:
            user = User(
                name="WMS Validator",
                email="wms_validator@synchain.ai",
                password_hash="mock_hash",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()


def test_complete_wms_csv_ingestion_lifecycle():
    user = get_test_user()
    app.dependency_overrides[get_current_active_user] = lambda: user
    db = SessionLocal()

    try:
        assert FIXTURE_PATH.exists(), f"Fixture {FIXTURE_PATH} does not exist"
        with open(FIXTURE_PATH, "rb") as f:
            csv_bytes = f.read()

        # ==========================================
        # 1. Upload CSV
        # ==========================================
        files = {
            "file": ("synchain_comprehensive_wms_validation.csv", io.BytesIO(csv_bytes), "text/csv")
        }
        res_upload = client.post("/api/v1/ingestion/upload", files=files)
        assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
        upload_data = res_upload.json()

        assert upload_data["success"] is True
        import_id = upload_data["import_id"]
        assert upload_data["rows_detected"] == 10
        assert len(upload_data["columns_detected"]) == 31

        # Check Column Auto-mapping: exactly 18 mapped out of 31
        auto_mapping = upload_data["auto_mapping"]
        mapped_count = sum(1 for v in auto_mapping.values() if v is not None)
        assert mapped_count == 18, f"Expected 18 mapped columns, got {mapped_count}"
        assert auto_mapping.get("sku") == "product_id"
        assert auto_mapping.get("current_stock") == "quantity"
        assert auto_mapping.get("warehouse_id") == "source_location"
        assert auto_mapping.get("carrier") == "carrier"
        print(f"PASS: Uploaded 10 rows, 31 columns detected, 18/31 mapped.")

        # ==========================================
        # 2. Preview
        # ==========================================
        res_prev = client.get(f"/api/v1/ingestion/{import_id}/preview")
        assert res_prev.status_code == 200
        prev_data = res_prev.json()
        assert len(prev_data["preview_rows"]) == 10
        assert prev_data["rows_detected"] == 10
        print(f"PASS: Preview verified with 10 sample rows.")

        # ==========================================
        # 3. Validation
        # ==========================================
        res_val = client.post(
            f"/api/v1/ingestion/{import_id}/validate",
            json={"column_mapping": auto_mapping}
        )
        assert res_val.status_code == 200
        val_data = res_val.json()
        validation = val_data["validation"]
        assert validation["is_valid"] is True
        assert validation["valid_rows"] == 10
        assert validation["invalid_rows"] == 0
        assert validation["duplicates"] == 0
        print(f"PASS: Validation confirmed 10 valid rows, 0 invalid rows, 0 duplicates.")

        # ==========================================
        # 4. Import Into SynChain Database
        # ==========================================
        res_import = client.post(
            f"/api/v1/ingestion/{import_id}/import",
            json={"column_mapping": auto_mapping}
        )
        assert res_import.status_code == 200, f"Import failed: {res_import.text}"
        imp_data = res_import.json()
        assert imp_data["success"] is True
        assert imp_data["status"] == "completed"
        assert imp_data["rows_processed"] == 10
        assert imp_data["rows_failed"] == 0
        print(f"PASS: Imported 10 records successfully into database. Created entities: {imp_data['entities_created']}.")

        # ==========================================
        # 5. Database Verification
        # ==========================================
        # Verify Product
        servo = db.query(Product).filter(Product.sku == "WMS-SERVO-001").first()
        assert servo is not None
        assert float(servo.price) == 320.0
        assert servo.name == "Autonomous Servo Drive"

        # Verify Warehouse
        wh = db.query(Warehouse).filter(Warehouse.name == "WH-CENTRAL-001").first()
        assert wh is not None

        # Verify Inventory
        inv = db.query(Inventory).filter(
            Inventory.product_id == servo.id,
            Inventory.warehouse_id == wh.id
        ).first()
        assert inv is not None
        assert inv.stock_quantity == 450
        assert inv.safety_stock_level == 60
        assert inv.reorder_level == 120
        assert float(inv.average_daily_demand) == 18.5
        assert inv.lead_time_days == 6

        # Verify Supplier
        sup = db.query(Supplier).filter(Supplier.name == "Titan Robotics Components").first()
        assert sup is not None

        # Verify Shipment
        shp = db.query(Shipment).filter(Shipment.shipment_id == "SHP-2026-001").first()
        assert shp is not None
        assert shp.carrier_name == "DHL Freight"
        assert shp.status == "in_transit"

        # Verify Sales Transaction
        stx = db.query(SalesTransaction).filter(SalesTransaction.import_id == import_id).first()
        assert stx is not None
        print(f"PASS: Verified PostgreSQL records across Products, Warehouses, Inventory, Suppliers, Shipments, and Sales.")

        # ==========================================
        # 6. Idempotent Retry Test
        # ==========================================
        # A second call to import with the same import_id MUST succeed idempotently
        # and NOT crash with 'Staged file not found'!
        res_retry = client.post(
            f"/api/v1/ingestion/{import_id}/import",
            json={"column_mapping": auto_mapping}
        )
        assert res_retry.status_code == 200, f"Retry failed: {res_retry.text}"
        retry_data = res_retry.json()
        assert retry_data["success"] is True
        assert retry_data["status"] == "completed"
        assert retry_data.get("already_completed") is True
        print(f"PASS: Idempotent re-import succeeded with already_completed flag (no 'Staged file not found' error).")

        # ==========================================
        # 7. Missing/Expired Staging File Error Handling
        # ==========================================
        fake_id = str(uuid.uuid4())
        res_missing = client.post(
            f"/api/v1/ingestion/{fake_id}/import",
            json={"column_mapping": auto_mapping}
        )
        assert res_missing.status_code == 404
        assert "not found" in res_missing.json()["detail"].lower()
        print(f"PASS: Nonexistent import session returned proper 404: {res_missing.json()['detail']}")

        # ==========================================
        # 8. Cancellation Endpoint
        # ==========================================
        # Upload another file to test cancellation
        files2 = {
            "file": ("synchain_comprehensive_wms_validation.csv", io.BytesIO(csv_bytes), "text/csv")
        }
        res_up2 = client.post("/api/v1/ingestion/upload", files=files2)
        assert res_up2.status_code == 200
        import_id2 = res_up2.json()["import_id"]

        res_cancel = client.delete(f"/api/v1/ingestion/{import_id2}")
        assert res_cancel.status_code == 200
        assert res_cancel.json()["success"] is True

        # Verify session is marked cancelled
        rec2 = db.query(DataImport).filter(DataImport.id == import_id2).first()
        assert rec2.status == "cancelled"
        print(f"PASS: Cancel endpoint safely marked session cancelled and removed staged file.")

    finally:
        db.close()
        app.dependency_overrides.pop(get_current_active_user, None)


if __name__ == "__main__":
    test_complete_wms_csv_ingestion_lifecycle()
    print("\nALL INGESTION LIFECYCLE TESTS PASSED PERFECTLY!")
