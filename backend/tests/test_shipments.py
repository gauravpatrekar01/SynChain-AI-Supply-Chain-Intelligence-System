import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.postgres.models import Shipment, Supplier
from app.services.shipments.risk_scoring import ShipmentRiskScorer, get_risk_level
from app.core.database import SessionLocal

client = TestClient(app)


def test_risk_level_boundaries():
    """Verify exact risk level assignments at score boundaries:
    0–29: LOW
    30–59: MEDIUM
    60–79: HIGH
    80–100: CRITICAL
    """
    assert get_risk_level(0) == "LOW"
    assert get_risk_level(29) == "LOW"
    assert get_risk_level(30) == "MEDIUM"
    assert get_risk_level(59) == "MEDIUM"
    assert get_risk_level(60) == "HIGH"
    assert get_risk_level(79) == "HIGH"
    assert get_risk_level(80) == "CRITICAL"
    assert get_risk_level(100) == "CRITICAL"


def test_risk_calculation_score_range_and_missing_factors():
    """Test risk calculation produces scores within 0-100, handles missing supplier safely,
    and returns correct data completeness and factor weights summing to 1.0."""
    now = datetime.now(timezone.utc)
    dep = now - timedelta(days=2)
    eta = now + timedelta(days=5)

    # 1. Without supplier (missing factor)
    res_no_supplier = ShipmentRiskScorer.calculate_risk(
        shipment_id="TEST-RISK-01",
        transport_mode="Ocean",
        departure_date=dep,
        expected_delivery_date=eta,
        status="in_transit",
        supplier=None,
    )

    assert 0 <= res_no_supplier["risk_score"] <= 100
    assert res_no_supplier["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert res_no_supplier["data_completeness"] == "PARTIAL"

    # Verify weights of available factors sum to approximately 1.0
    avail_factors = [f for f in res_no_supplier["risk_factors"] if f["available"]]
    total_weight = sum(f["weight"] for f in avail_factors)
    assert abs(total_weight - 1.0) < 0.01

    # 2. Delayed status produces high risk
    res_delayed = ShipmentRiskScorer.calculate_risk(
        shipment_id="TEST-RISK-02",
        transport_mode="Ocean",
        departure_date=dep,
        expected_delivery_date=eta,
        status="delayed",
        supplier=None,
    )
    assert res_delayed["risk_score"] >= 60
    assert res_delayed["risk_level"] in ("HIGH", "CRITICAL")


def test_create_and_retrieve_shipment():
    """Test creating a valid shipment, retrieving it by ID, and checking response structure."""
    now = datetime.now(timezone.utc)
    payload = {
        "shipment_id": "TEST-SHP-001",
        "shipment_name": "Silicon Microcomponents Consignment",
        "origin": "Taipei, Taiwan",
        "destination": "Austin, TX",
        "cargo_description": "Microprocessors & Sensors",
        "quantity": 500,
        "transport_mode": "Air",
        "departure_date": (now - timedelta(days=1)).isoformat(),
        "expected_delivery_date": (now + timedelta(days=2)).isoformat(),
        "carrier_name": "FedEx Express International",
        "tracking_number": "FX-TEST-12345",
        "status": "in_transit",
    }

    resp = client.post("/api/v1/shipments", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["shipment_id"] == "TEST-SHP-001"
    assert data["shipment_name"] == "Silicon Microcomponents Consignment"
    assert data["transport_mode"] == "Air"
    assert 0 <= data["risk_score"] <= 100
    assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert "tracking_history" in data
    assert len(data["tracking_history"]) >= 1

    # Retrieve by business shipment_id
    get_resp = client.get(f"/api/v1/shipments/{data['shipment_id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == data["id"]

    # Retrieve by UUID
    get_by_uuid = client.get(f"/api/v1/shipments/{data['id']}")
    assert get_by_uuid.status_code == 200
    assert get_by_uuid.json()["shipment_id"] == "TEST-SHP-001"


def test_reject_duplicate_shipment_id():
    """Ensure duplicate shipment IDs are rejected with HTTP 400."""
    now = datetime.now(timezone.utc)
    payload = {
        "shipment_id": "TEST-DUP-001",
        "shipment_name": "Consignment Original",
        "origin": "Hamburg, Germany",
        "destination": "New York, NY",
        "cargo_description": "Specialty Alloys",
        "quantity": 100,
        "transport_mode": "Ocean",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=7)).isoformat(),
        "carrier_name": "Hapag-Lloyd",
    }

    resp1 = client.post("/api/v1/shipments", json=payload)
    assert resp1.status_code == 201

    resp2 = client.post("/api/v1/shipments", json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"]


def test_reject_invalid_shipment_data():
    """Reject invalid data: negative quantity, expected delivery earlier than departure, invalid transport mode."""
    now = datetime.now(timezone.utc)

    # 1. Negative / zero quantity
    bad_qty = {
        "shipment_id": "TEST-BAD-QTY",
        "shipment_name": "Bad Quantity Consignment",
        "origin": "Tokyo, Japan",
        "destination": "San Francisco, CA",
        "cargo_description": "Optics",
        "quantity": -5,
        "transport_mode": "Air",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=3)).isoformat(),
        "carrier_name": "ANA Cargo",
    }
    resp = client.post("/api/v1/shipments", json=bad_qty)
    assert resp.status_code == 422

    # 2. Inverted dates (ETA earlier than departure)
    bad_dates = {
        "shipment_id": "TEST-BAD-DATES",
        "shipment_name": "Inverted Dates Consignment",
        "origin": "Tokyo, Japan",
        "destination": "San Francisco, CA",
        "cargo_description": "Optics",
        "quantity": 50,
        "transport_mode": "Air",
        "departure_date": (now + timedelta(days=5)).isoformat(),
        "expected_delivery_date": now.isoformat(),
        "carrier_name": "ANA Cargo",
    }
    resp_dates = client.post("/api/v1/shipments", json=bad_dates)
    assert resp_dates.status_code == 422

    # 3. Invalid transport mode
    bad_mode = {
        "shipment_id": "TEST-BAD-MODE",
        "shipment_name": "Bad Mode Consignment",
        "origin": "Tokyo, Japan",
        "destination": "San Francisco, CA",
        "cargo_description": "Optics",
        "quantity": 50,
        "transport_mode": "Teleportation",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=3)).isoformat(),
        "carrier_name": "ANA Cargo",
    }
    resp_mode = client.post("/api/v1/shipments", json=bad_mode)
    assert resp_mode.status_code == 422


def test_nonexistent_shipment_id_returns_404():
    """Handle nonexistent shipment IDs with HTTP 404."""
    resp = client.get("/api/v1/shipments/NON-EXISTENT-ID-9999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_update_shipment_and_recalculate_risk():
    """Update shipment status to delayed and verify automatic risk recalculation."""
    now = datetime.now(timezone.utc)
    create_payload = {
        "shipment_id": "TEST-UPDATE-001",
        "shipment_name": "Electronics Batch For Update",
        "origin": "Seoul, South Korea",
        "destination": "Chicago, IL",
        "cargo_description": "Display Panels",
        "quantity": 1000,
        "transport_mode": "Ocean",
        "departure_date": (now - timedelta(days=5)).isoformat(),
        "expected_delivery_date": (now + timedelta(days=10)).isoformat(),
        "carrier_name": "Hyundai Merchant Marine",
        "status": "in_transit",
    }
    created = client.post("/api/v1/shipments", json=create_payload).json()
    init_score = created["risk_score"]

    # Update status to 'delayed'
    update_payload = {
        "status": "delayed",
        "cargo_description": "Display Panels - Expedited Inspection",
    }
    update_resp = client.put(f"/api/v1/shipments/{created['shipment_id']}", json=update_payload)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["status"] == "delayed"
    assert updated_data["cargo_description"] == "Display Panels - Expedited Inspection"
    assert updated_data["risk_score"] >= init_score
    assert len(updated_data["tracking_history"]) > len(created["tracking_history"])


def test_delete_shipment():
    """Delete a shipment and verify it is removed from database and returns 404 subsequently."""
    now = datetime.now(timezone.utc)
    create_payload = {
        "shipment_id": "TEST-DELETE-001",
        "shipment_name": "Consignment To Delete",
        "origin": "London, UK",
        "destination": "Boston, MA",
        "cargo_description": "Lab Equipment",
        "quantity": 10,
        "transport_mode": "Air",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=2)).isoformat(),
        "carrier_name": "British Airways Cargo",
    }
    created = client.post("/api/v1/shipments", json=create_payload).json()

    # Delete
    del_resp = client.delete(f"/api/v1/shipments/{created['shipment_id']}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # Retrieve should return 404
    get_resp = client.get(f"/api/v1/shipments/{created['shipment_id']}")
    assert get_resp.status_code == 404


def test_shipment_summary_counts():
    """Verify summary counts correctly reflect total, in_transit, delivered, delayed, and high risk."""
    now = datetime.now(timezone.utc)
    # Clear out or create distinct entries
    s1 = {
        "shipment_id": "TEST-SUM-001",
        "shipment_name": "Transit Alpha",
        "origin": "A",
        "destination": "B",
        "cargo_description": "Goods",
        "quantity": 10,
        "transport_mode": "Air",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=2)).isoformat(),
        "carrier_name": "Carrier 1",
        "status": "in_transit",
    }
    s2 = {
        "shipment_id": "TEST-SUM-002",
        "shipment_name": "Delivered Beta",
        "origin": "C",
        "destination": "D",
        "cargo_description": "Goods",
        "quantity": 20,
        "transport_mode": "Ground",
        "departure_date": (now - timedelta(days=3)).isoformat(),
        "expected_delivery_date": (now - timedelta(days=1)).isoformat(),
        "carrier_name": "Carrier 2",
        "status": "delivered",
    }
    s3 = {
        "shipment_id": "TEST-SUM-003",
        "shipment_name": "Delayed Gamma",
        "origin": "E",
        "destination": "F",
        "cargo_description": "Goods",
        "quantity": 30,
        "transport_mode": "Ocean",
        "departure_date": (now - timedelta(days=10)).isoformat(),
        "expected_delivery_date": (now - timedelta(days=1)).isoformat(),
        "carrier_name": "Carrier 3",
        "status": "delayed",
    }

    client.post("/api/v1/shipments", json=s1)
    client.post("/api/v1/shipments", json=s2)
    client.post("/api/v1/shipments", json=s3)

    summary_resp = client.get("/api/v1/shipments/summary")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["total_shipments"] >= 3
    assert summary["in_transit"] >= 1
    assert summary["delivered"] >= 1
    assert summary["delayed"] >= 1
    assert summary["high_risk"] >= 1


def test_explicit_recalculate_risk_endpoint():
    """Test POST /api/v1/shipments/{id}/recalculate-risk returns structured risk object."""
    now = datetime.now(timezone.utc)
    payload = {
        "shipment_id": "TEST-RECALC-001",
        "shipment_name": "Recalculation Target",
        "origin": "Shenzhen, China",
        "destination": "Memphis, TN",
        "cargo_description": "Capacitors",
        "quantity": 5000,
        "transport_mode": "Ocean",
        "departure_date": now.isoformat(),
        "expected_delivery_date": (now + timedelta(days=14)).isoformat(),
        "carrier_name": "Maersk",
    }
    created = client.post("/api/v1/shipments", json=payload).json()

    recalc_resp = client.post(f"/api/v1/shipments/{created['shipment_id']}/recalculate-risk")
    assert recalc_resp.status_code == 200
    risk = recalc_resp.json()
    assert risk["shipment_id"] == "TEST-RECALC-001"
    assert 0 <= risk["risk_score"] <= 100
    assert risk["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert len(risk["risk_factors"]) > 0
    assert "data_completeness" in risk
