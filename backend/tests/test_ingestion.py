import io
import uuid
import pytest
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import User, DataImport, ImportedRecord, Product, Warehouse, Inventory
from app.ingestion.csv_parser import parse_csv_file
from app.ingestion.excel_parser import parse_excel_file, get_excel_sheet_names
from app.ingestion.normalizer import auto_map_columns, normalize_records, CANONICAL_SCHEMA
from app.ingestion.validator import validate_supply_chain_data

client = TestClient(app)

from app.core.database import SessionLocal

def override_get_current_active_user():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            user = User(
                name="Test Ingestion Engineer",
                email="ingest_test@synchain.ai",
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


# 1. Unit Tests for Parsers
def test_csv_parser_normal_and_semicolon():
    csv_content = b"SKU,Product Name,Quantity,Location\nP001,Steel Sheet,500,Pune\nP002,Copper Wire,250,Mumbai\n"
    res = parse_csv_file(csv_content, "inventory.csv")
    assert res["total_rows"] == 2
    assert "SKU" in res["headers"]
    assert res["rows"][0]["SKU"] == "P001"
    assert res["rows"][0]["Quantity"] == "500"

    # Semicolon delimited
    csv_semi = b"SKU;Product Name;Quantity;Location\nP100;Bolts;900;Nashik\n"
    res_semi = parse_csv_file(csv_semi, "inventory_semi.csv")
    assert res_semi["total_rows"] == 1
    assert res_semi["delimiter"] == ";"
    assert res_semi["rows"][0]["SKU"] == "P100"


def test_csv_parser_malformed_and_missing_values():
    csv_content = b"Item Code,Description,Qty\nI01,Widget Alpha,50\nI02,Malformed Line Only One Col\nI03,Widget Gamma,N/A\n"
    res = parse_csv_file(csv_content, "bad.csv")
    assert res["total_rows"] == 3
    assert len(res["malformed_rows"]) == 1
    # Check that N/A is cleaned to None
    assert res["rows"][2]["Qty"] is None


def test_excel_multi_sheet_parsing():
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df1 = pd.DataFrame([
            {"SKU": "E001", "Name": "Microcontroller", "Quantity": 1200, "Warehouse": "Austin Hub"},
            {"SKU": "E002", "Name": "Capacitor 10uF", "Quantity": 50000, "Warehouse": "Dallas Depot"}
        ])
        df1.to_excel(writer, sheet_name="Inventory", index=False)

        df2 = pd.DataFrame([
            {"Order ID": "ORD-99", "Item Code": "E001", "Qty": 300, "Vendor": "AsiaTech"}
        ])
        df2.to_excel(writer, sheet_name="Orders", index=False)

    content = buffer.getvalue()
    sheet_names = get_excel_sheet_names(content, "multisheet.xlsx")
    assert "Inventory" in sheet_names
    assert "Orders" in sheet_names

    # Parse sheet 1
    parsed_inv = parse_excel_file(content, "multisheet.xlsx", sheet_name="Inventory")
    assert parsed_inv["total_rows"] == 2
    assert parsed_inv["rows"][0]["SKU"] == "E001"

    # Parse sheet 2
    parsed_ord = parse_excel_file(content, "multisheet.xlsx", sheet_name="Orders")
    assert parsed_ord["total_rows"] == 1
    assert parsed_ord["rows"][0]["Order ID"] == "ORD-99"


# 2. Unit Tests for Normalizer & Validator
def test_auto_mapping_supply_chain_aliases():
    cols = ["Item Code", "Item Name", "Qty", "Vendor", "From", "To", "Expected Date", "Standard Cost"]
    mapping = auto_map_columns(cols)
    assert mapping["Item Code"] == "product_id"
    assert mapping["Item Name"] == "product_name"
    assert mapping["Qty"] == "quantity"
    assert mapping["Vendor"] == "supplier"
    assert mapping["From"] == "source_location"
    assert mapping["To"] == "destination"
    assert mapping["Expected Date"] == "expected_delivery"
    assert mapping["Standard Cost"] == "unit_price"


def test_validation_logic():
    records = [
        {"product_id": "P01", "quantity": 100, "unit_price": 45.5, "order_date": "2026-05-10"},
        {"product_id": "P02", "quantity": "five hundred", "unit_price": 10.0},  # invalid qty string
        {"product_id": "P03", "quantity": -20, "unit_price": 5.0},  # negative qty
        {"product_id": "P04", "quantity": 50, "order_date": "not-a-date"},  # invalid date
        {"product_id": "P01", "quantity": 100, "source_location": None},  # duplicate
    ]
    val = validate_supply_chain_data(records)
    assert val["is_valid"] is False
    assert val["valid_rows"] == 2
    assert val["invalid_rows"] == 3
    assert val["duplicates_count"] == 1
    error_messages = [e["message"] for e in val["errors"]]
    assert any("five hundred" in msg for msg in error_messages)
    assert any("negative" in msg for msg in error_messages)
    assert any("Invalid date" in msg for msg in error_messages)


# 3. Integration / API Tests
def test_canonical_schema_endpoint():
    res = client.get("/api/v1/ingestion/canonical-schema")
    assert res.status_code == 200
    data = res.json()
    assert "fields" in data
    assert "product_id" in data["fields"]
    assert "quantity" in data["fields"]


def test_unauthorized_upload():
    # Calling upload without auth should return 401
    file_content = b"sku,name\nA1,Part1\n"
    res = client.post(
        "/api/v1/ingestion/upload",
        files={"file": ("test.csv", file_content, "text/csv")}
    )
    assert res.status_code == 401


def test_e2e_csv_upload_validate_and_import():
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user

    try:
        # 1. Upload CSV
        csv_data = (
            "SKU,Product Name,Quantity,Location,Vendor,Price\n"
            "SYN-TEST-101,Titanium Bracket,150,Austin Hub,AeroMaterials,120.50\n"
            "SYN-TEST-102,Carbon Composite,75,Dallas Depot,Plastech,45.00\n"
            "SYN-TEST-103,Nylon Gear,300,Memphis Hub,PrecisionMfg,12.25\n"
        ).encode("utf-8")

        res_upload = client.post(
            "/api/v1/ingestion/upload",
            files={"file": ("test_inventory.csv", csv_data, "text/csv")}
        )
        assert res_upload.status_code == 200
        upload_data = res_upload.json()
        assert upload_data["success"] is True
        import_id = upload_data["import_id"]
        assert upload_data["rows_detected"] == 3
        assert "SKU" in upload_data["columns_detected"]
        assert upload_data["auto_mapping"]["SKU"] == "product_id"

        # 2. Preview
        res_prev = client.get(f"/api/v1/ingestion/{import_id}/preview")
        assert res_prev.status_code == 200
        prev_data = res_prev.json()
        assert len(prev_data["preview_rows"]) == 3

        # 3. Validate
        res_val = client.post(
            f"/api/v1/ingestion/{import_id}/validate",
            json={"column_mapping": upload_data["auto_mapping"]}
        )
        assert res_val.status_code == 200
        val_data = res_val.json()
        assert val_data["validation"]["is_valid"] is True
        assert val_data["validation"]["valid_rows"] == 3

        # 4. Import
        res_imp = client.post(
            f"/api/v1/ingestion/{import_id}/import",
            json={"column_mapping": upload_data["auto_mapping"]}
        )
        assert res_imp.status_code == 200
        imp_data = res_imp.json()
        assert imp_data["success"] is True
        assert imp_data["rows_processed"] == 3
        assert imp_data["status"] == "completed"

        # 5. History
        res_hist = client.get("/api/v1/ingestion/history")
        assert res_hist.status_code == 200
        history = res_hist.json()
        assert any(item["id"] == import_id for item in history)

    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


def test_reject_unsupported_file():
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    try:
        res = client.post(
            "/api/v1/ingestion/upload",
            files={"file": ("notes.txt", b"plain text content", "text/plain")}
        )
        assert res.status_code == 400
        assert "Unsupported file type" in res.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


def test_reject_empty_file():
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user
    try:
        res = client.post(
            "/api/v1/ingestion/upload",
            files={"file": ("empty.csv", b"", "text/csv")}
        )
        assert res.status_code == 400
        assert "empty" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)
