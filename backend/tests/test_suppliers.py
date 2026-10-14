import io
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.postgres.models import Supplier, Shipment
from app.core.database import SessionLocal

client = TestClient(app)


def test_download_supplier_template():
    response = client.get("/api/v1/suppliers/import/template")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "synchain_suppliers_template.csv" in response.headers.get("content-disposition", "")
    content = response.text
    assert "supplier_code" in content
    assert "name" in content
    assert "tier" in content
    assert "reliability" in content


def test_create_supplier_manual_valid_and_invalid():
    # Valid creation
    payload = {
        "name": "Apex Semiconductor Corp",
        "supplier_code": "SUP-APEX-001",
        "tier": "Tier-1",
        "category": "Electronics",
        "location": "Hsinchu Science Park, Taiwan",
        "contact_person": "Dr. Morris Chen",
        "email": "mchen@apex-semi.com",
        "phone": "+886 3 578 0001",
        "reliability_score": 94.0,
        "quality_rating": 98.0,
        "lead_time_days": 18,
        "capacity": 50000,
        "spend_usd": 12500000.0,
        "health_status": "optimal",
        "single_source": True,
        "is_active": True,
    }
    res = client.post("/api/v1/suppliers", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Apex Semiconductor Corp"
    assert data["supplier_code"] == "SUP-APEX-001"
    assert data["reliability_score"] == 94.0
    assert data["reliabilityScore"] == 94.0  # camelCase alias
    assert data["health_status"] == "optimal"
    assert data["single_source_risk"] is True
    assert data["single_source"] is True
    assert data["id"] is not None

    # Duplicate code rejection
    res_dup = client.post("/api/v1/suppliers", json=payload)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()

    # Invalid email validation
    bad_payload = payload.copy()
    bad_payload["name"] = "Different Name 1"
    bad_payload["supplier_code"] = "SUP-APEX-002"
    bad_payload["email"] = "not-an-email"
    res_bad = client.post("/api/v1/suppliers", json=bad_payload)
    assert res_bad.status_code == 422

    # Invalid reliability score (> 100.0)
    bad_rel = payload.copy()
    bad_rel["name"] = "Different Name 2"
    bad_rel["supplier_code"] = "SUP-APEX-003"
    bad_rel["reliability_score"] = 150.0
    res_bad_rel = client.post("/api/v1/suppliers", json=bad_rel)
    assert res_bad_rel.status_code == 422


def test_supplier_crud_operations():
    # 1. Create
    create_res = client.post(
        "/api/v1/suppliers",
        json={
            "name": "Nordic Lithium Solutions",
            "supplier_code": "SUP-NOR-010",
            "tier": "Tier-2",
            "category": "Raw Materials",
            "location": "Oslo, Norway",
            "reliability_score": 88.0,
            "spend_usd": 4200000.0,
            "health_status": "warning",
            "single_source": False,
        },
    )
    assert create_res.status_code == 201
    supplier_id = create_res.json()["id"]

    # 2. Get by UUID
    get_res = client.get(f"/api/v1/suppliers/{supplier_id}")
    assert get_res.status_code == 200
    assert get_res.json()["supplier_code"] == "SUP-NOR-010"

    # 3. Get by supplier_code
    get_code_res = client.get("/api/v1/suppliers/SUP-NOR-010")
    assert get_code_res.status_code == 200
    assert get_code_res.json()["id"] == supplier_id

    # 4. Update
    patch_res = client.put(
        f"/api/v1/suppliers/{supplier_id}",
        json={
            "reliability_score": 92.0,
            "health_status": "optimal",
            "lead_time_days": 14,
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["reliability_score"] == 92.0
    assert patch_res.json()["health_status"] == "optimal"
    assert patch_res.json()["lead_time_days"] == 14

    # 5. Delete (safe delete with no references)
    del_res = client.delete(f"/api/v1/suppliers/{supplier_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 6. Verify deleted
    get_del = client.get(f"/api/v1/suppliers/{supplier_id}")
    assert get_del.status_code == 404


def test_supplier_delete_protection_when_referenced():
    """Ensure a supplier cannot be deleted if referenced by active shipments."""
    create_res = client.post(
        "/api/v1/suppliers",
        json={
            "name": "Pacific Freight Logistics",
            "supplier_code": "SUP-PAC-099",
            "tier": "Tier-1",
        },
    )
    assert create_res.status_code == 201
    supplier_id = create_res.json()["id"]

    # Link a shipment in DB with non-null shipment_name
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        shipment = Shipment(
            shipment_id="SHP-TEST-DEL-01",
            shipment_name="Pacific Component Cargo",
            supplier_id=supplier_id,
            origin="Shenzhen, China",
            destination="Long Beach, USA",
            cargo_description="Electronic parts",
            carrier_name="Oceanic Express",
            transport_mode="Ocean",
            departure_date=now - timedelta(days=2),
            expected_delivery_date=now + timedelta(days=10),
            status="in_transit",
        )
        db.add(shipment)
        db.commit()
    finally:
        db.close()

    # Attempt to delete -> Should return 409 Conflict
    del_res = client.delete(f"/api/v1/suppliers/{supplier_id}")
    assert del_res.status_code == 409
    assert "referenced by 1 shipment(s)" in del_res.json()["detail"].lower()


def test_supplier_list_filter_search_sort():
    # Insert multiple suppliers
    s1 = {
        "name": "Alpha Microchips",
        "supplier_code": "SUP-ALPHA",
        "tier": "Tier-1",
        "category": "Electronics",
        "location": "Seoul, South Korea",
        "reliability_score": 95.0,
        "spend_usd": 10000000.0,
        "health_status": "optimal",
        "is_active": True,
    }
    s2 = {
        "name": "Beta Polymers",
        "supplier_code": "SUP-BETA",
        "tier": "Tier-2",
        "category": "Chemicals",
        "location": "Dusseldorf, Germany",
        "reliability_score": 82.0,
        "spend_usd": 3000000.0,
        "health_status": "warning",
        "is_active": True,
    }
    s3 = {
        "name": "Gamma Rare Earths",
        "supplier_code": "SUP-GAMMA",
        "tier": "Tier-1",
        "category": "Mining",
        "location": "Perth, Australia",
        "reliability_score": 65.0,
        "spend_usd": 7000000.0,
        "health_status": "critical",
        "is_active": False,
    }
    for s in [s1, s2, s3]:
        client.post("/api/v1/suppliers", json=s)

    # 1. Flat list backward compatibility
    res_flat = client.get("/api/v1/suppliers")
    assert res_flat.status_code == 200
    assert isinstance(res_flat.json(), list)
    assert len(res_flat.json()) >= 3

    # 2. Paginated envelope
    res_paged = client.get("/api/v1/suppliers?page=1&page_size=2")
    assert res_paged.status_code == 200
    paged_data = res_paged.json()
    assert "items" in paged_data
    assert paged_data["total"] >= 3
    assert len(paged_data["items"]) == 2
    assert paged_data["page"] == 1
    assert paged_data["pages"] >= 2

    # 3. Filter by Tier-1
    res_t1 = client.get("/api/v1/suppliers?tier=Tier-1&page=1&page_size=10")
    t1_names = [item["name"] for item in res_t1.json()["items"]]
    assert "Alpha Microchips" in t1_names
    assert "Gamma Rare Earths" in t1_names
    assert "Beta Polymers" not in t1_names

    # 4. Search by keyword
    res_search = client.get("/api/v1/suppliers?search=Polymers&page=1&page_size=10")
    assert len(res_search.json()["items"]) == 1
    assert res_search.json()["items"][0]["supplier_code"] == "SUP-BETA"

    # 5. Filter by active
    res_active = client.get("/api/v1/suppliers?is_active=false&page=1&page_size=10")
    assert any(item["supplier_code"] == "SUP-GAMMA" for item in res_active.json()["items"])


def test_supplier_csv_import_preview_and_confirm():
    # Prepare CSV with formula injection attempts, UTF-8 BOM, valid row, duplicate row, and invalid row
    csv_content = (
        "\ufeffSupplier Name,Supplier Code,Tier,Category,Location,Contact Person,Email,Phone,Reliability,Quality,Lead Time Days,Spend USD,Health Status,Single Source\n"
        "=CMD|' /C calc'!A0,SUP-INJ-001,Tier-1,Sensors,Munich,Hans Meier,hans@sensor.de,+49 89 1234,91.0,94.5,15,500000,optimal,No\n"
        "Tokyo Robotics Inc,SUP-TOK-002,Tier-1,Robotics,Tokyo Japan,Kenji Sato,kenji@tokyo-robotics.jp,+81 3 5555,96.0,98.0,20,8500000,optimal,Yes\n"
        "Tokyo Robotics Duplicate,SUP-TOK-002,Tier-2,Robotics,Tokyo Japan,Kenji Sato,kenji2@tokyo.jp,,90.0,94.0,20,100000,optimal,No\n"
        "Faulty Supplier,SUP-FLT-004,Tier-3,Parts,Berlin,Klaus,invalid-email,,bad-number,,10,20000,optimal,No\n"
    )

    csv_file = io.BytesIO(csv_content.encode("utf-8"))

    # 1. Preview
    res_preview = client.post(
        "/api/v1/suppliers/import/preview",
        files={"file": ("suppliers_upload.csv", csv_file, "text/csv")},
    )
    assert res_preview.status_code == 200
    preview = res_preview.json()

    assert preview["total_rows"] == 4
    assert preview["valid_rows"] >= 2
    assert preview["duplicate_rows"] >= 1
    assert preview["errors"] is not None
    assert preview["preview_token"] is not None

    # Verify formula injection was neutralized
    inj_record = next(r for r in preview["preview_records"] if r["supplier_code"] == "SUP-INJ-001")
    assert not inj_record["name"].startswith("=")

    # Verify duplicate row was captured in errors
    dup_error = next(e for e in preview["errors"] if e.get("field") == "supplier_code")
    assert "duplicate" in dup_error["message"].lower()

    # 2. Confirm import using token
    token = preview["preview_token"]
    res_confirm = client.post(
        "/api/v1/suppliers/import/confirm",
        json={"preview_token": token, "mode": "skip_duplicates"},
    )
    assert res_confirm.status_code == 200
    confirm_data = res_confirm.json()
    assert confirm_data["success"] is True
    assert confirm_data["imported_count"] == 2

    # 3. Verify Tokyo Robotics was inserted into DB
    res_verify = client.get("/api/v1/suppliers/SUP-TOK-002")
    assert res_verify.status_code == 200
    assert res_verify.json()["name"] == "Tokyo Robotics Inc"
    assert res_verify.json()["spend_annual_usd"] == 8500000.0

    # 4. Token cannot be reused
    res_reuse = client.post(
        "/api/v1/suppliers/import/confirm",
        json={"preview_token": token, "mode": "skip_duplicates"},
    )
    assert res_reuse.status_code == 400
