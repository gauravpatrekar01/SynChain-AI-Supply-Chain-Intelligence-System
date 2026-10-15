import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.postgres.models import Product, Warehouse, Inventory
from app.core.database import SessionLocal
from app.services.inventory.inventory_service import InventoryService

client = TestClient(app)


def test_inventory_template_download():
    """Verify CSV template generates correctly with canonical columns."""
    res = client.get("/api/v1/inventory/import/template")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "synchain_inventory_template.csv" in res.headers.get("content-disposition", "")
    content = res.text
    assert "sku" in content
    assert "product_name" in content
    assert "warehouse_name" in content
    assert "on_hand_quantity" in content
    assert "safety_stock" in content
    assert "average_daily_demand" in content


def test_create_and_get_inventory_product():
    """Verify manual creation of product, retrieval, and calculated fields."""
    unique_sku = f"TEST-SKU-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "sku": unique_sku,
        "name": "Superconducting AI Accelerator",
        "category": "Quantum Silicon",
        "warehouse_name": "Austin Hub",
        "on_hand_quantity": 20000,
        "reserved_quantity": 2000,
        "safety_stock": 10000,
        "reorder_point": 15000,
        "reorder_quantity": 8000,
        "average_daily_demand": 500.0,
        "lead_time_days": 14,
        "price": 2500.0,
    }

    res = client.post("/api/v1/inventory/items", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["sku"] == unique_sku
    assert data["name"] == "Superconducting AI Accelerator"
    assert data["on_hand_units"] == 20000
    assert data["reserved_units"] == 2000
    assert data["available_units"] == 18000  # 20000 - 2000
    assert data["safety_stock_units"] == 10000
    assert data["buffer_health_percentage"] == 180.0  # (18000 / 10000) * 100
    assert data["days_of_supply"] == 36.0  # 18000 / 500
    assert data["status"] == "optimal"
    inv_id = data["id"]

    # Retrieve by ID
    get_res = client.get(f"/api/v1/inventory/items/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["sku"] == unique_sku

    # Retrieve by SKU
    get_by_sku = client.get(f"/api/v1/inventory/items/{unique_sku}")
    assert get_by_sku.status_code == 200
    assert get_by_sku.json()["id"] == inv_id


def test_reject_duplicate_route():
    """Verify that adding duplicate product to the same facility is rejected."""
    unique_sku = f"TEST-DUP-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "sku": unique_sku,
        "name": "Redundant Sensor Module",
        "category": "Optoelectronics",
        "warehouse_name": "Austin Hub",
        "on_hand_quantity": 5000,
        "reserved_quantity": 0,
        "safety_stock": 2000,
    }
    res1 = client.post("/api/v1/inventory/items", json=payload)
    assert res1.status_code == 201

    # Duplicate submission
    res2 = client.post("/api/v1/inventory/items", json=payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"].lower()


def test_reject_invalid_quantities():
    """Verify validation rules on negative quantities and reserved exceeding on-hand."""
    # Negative on-hand
    bad1 = {
        "sku": f"BAD-{uuid.uuid4().hex[:6]}",
        "name": "Negative Stock Product",
        "on_hand_quantity": -50,
        "safety_stock": 100,
    }
    res1 = client.post("/api/v1/inventory/items", json=bad1)
    assert res1.status_code == 422

    # Negative safety stock
    bad2 = {
        "sku": f"BAD-{uuid.uuid4().hex[:6]}",
        "name": "Negative Safety Product",
        "on_hand_quantity": 100,
        "safety_stock": -20,
    }
    res2 = client.post("/api/v1/inventory/items", json=bad2)
    assert res2.status_code == 422

    # Reserved > On-hand
    bad3 = {
        "sku": f"BAD-{uuid.uuid4().hex[:6]}",
        "name": "Over-reserved Product",
        "on_hand_quantity": 100,
        "reserved_quantity": 500,
        "safety_stock": 50,
    }
    res3 = client.post("/api/v1/inventory/items", json=bad3)
    assert res3.status_code == 422


def test_update_and_delete_inventory_product():
    """Verify updating fields and safe deletion."""
    unique_sku = f"TEST-UPD-{uuid.uuid4().hex[:6].upper()}"
    create_res = client.post("/api/v1/inventory/items", json={
        "sku": unique_sku,
        "name": "Initial Name",
        "category": "Test Cat",
        "warehouse_name": "Dallas Depot",
        "on_hand_quantity": 1000,
        "safety_stock": 500,
    })
    assert create_res.status_code == 201
    inv_id = create_res.json()["id"]

    # Update
    update_res = client.put(f"/api/v1/inventory/items/{inv_id}", json={
        "name": "Updated Name Enterprise",
        "on_hand_quantity": 1500,
        "safety_stock": 600,
    })
    assert update_res.status_code == 200
    upd_data = update_res.json()
    assert upd_data["name"] == "Updated Name Enterprise"
    assert upd_data["on_hand_units"] == 1500
    assert upd_data["safety_stock_units"] == 600

    # Delete
    del_res = client.delete(f"/api/v1/inventory/items/{inv_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Check 404 after deletion
    get_res = client.get(f"/api/v1/inventory/items/{inv_id}")
    assert get_res.status_code == 404


def test_calculations_and_edge_cases():
    """Test buffer calculations: zero demand, zero safety stock, critical/warning/optimal status."""
    # Case A: Zero safety stock
    avail, days, buffer_pct, st = InventoryService.calculate_metrics(
        stock=1000,
        reserved=200,
        safety=0,
        reorder=300,
        avg_demand=50,
    )
    assert avail == 800
    assert buffer_pct == 100.0  # Safe zero safety stock handling
    assert days == 16.0  # 800 / 50
    assert st == "optimal"

    # Case B: Zero demand (no division by zero)
    avail2, days2, buffer_pct2, st2 = InventoryService.calculate_metrics(
        stock=500,
        reserved=100,
        safety=1000,
        reorder=1200,
        avg_demand=0,
    )
    assert avail2 == 400
    assert buffer_pct2 == 40.0  # (400 / 1000) * 100
    assert days2 == 6.0  # fallback run-rate 400 / (1000/15)
    assert st2 == "critical"  # Available (400) < Safety (1000)

    # Case C: Warning / Low status
    avail3, days3, buffer_pct3, st3 = InventoryService.calculate_metrics(
        stock=1200,
        reserved=100,
        safety=800,
        reorder=1500,
        avg_demand=100,
    )
    assert avail3 == 1100
    assert st3 == "warning"  # Safety (800) <= Available (1100) <= Reorder (1500)


def test_csv_import_workflow_and_edge_cases():
    """Test CSV import: preview, validation, UTF-8 BOM, duplicate detection, and confirmation."""
    sku1 = f"CSV-SKU-{uuid.uuid4().hex[:6].upper()}"
    sku2 = f"CSV-SKU-{uuid.uuid4().hex[:6].upper()}"

    # UTF-8 with BOM
    csv_text = (
        "sku,product_name,category,warehouse_name,on_hand_quantity,reserved_quantity,safety_stock,reorder_point,reorder_quantity,average_daily_demand,lead_time_days\n"
        f"{sku1},Photonics Sensor Array,Optical Systems,Austin Hub,12000,500,6000,8000,4000,300,14\n"
        f"{sku2},Solid State Relay 48V,Power Distribution,Memphis Hub,8500,0,5000,6500,3000,200,21\n"
        f"{sku1},Duplicate SKU In File,Optical Systems,Austin Hub,5000,0,2000,3000,1000,100,14\n"  # Duplicate in file
        ",Missing SKU Product,General,Austin Hub,1000,0,500,800,400,50,14\n"  # Missing SKU
        f"CSV-BAD-QTY,Invalid Stock,General,Austin Hub,-100,0,500,800,400,50,14\n"  # Negative stock
    )
    bom_bytes = b"\xef\xbb\xbf" + csv_text.encode("utf-8")

    # Preview
    preview_res = client.post(
        "/api/v1/inventory/import/preview",
        files={"file": ("inventory_test.csv", io.BytesIO(bom_bytes), "text/csv")},
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["total_rows"] == 5
    assert preview_data["valid_rows"] == 2  # sku1 and sku2 are valid
    assert preview_data["duplicate_rows"] == 1  # 3rd row is duplicate of sku1
    assert preview_data["invalid_rows"] == 2  # missing sku, negative stock
    assert len(preview_data["errors"]) >= 3
    token = preview_data["preview_token"]

    # Confirm import
    confirm_res = client.post(
        "/api/v1/inventory/import/confirm",
        json={"preview_token": token, "mode": "skip_duplicates"},
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["success"] is True
    assert confirm_data["imported_count"] == 2
    assert confirm_data["skipped_count"] == 1


def test_recalculate_multi_echelon_buffer():
    """Verify recalculation endpoint runs real calculations and updates database records."""
    res = client.post("/api/v1/inventory/recalculate-buffer")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "total_items" in data
    assert "recalculated_count" in data
    assert "statistical_count" in data
    assert "parametric_count" in data
    assert "insufficient_data_count" in data
    assert isinstance(data["details"], list)
