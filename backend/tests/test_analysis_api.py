"""
Integration test suite for the SynChain AI Analysis API.
Tests end-to-end HTTP interactions, Pydantic validation, risk scoring,
scenario simulation, and recommendation status lifecycle.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.postgres.models import Shipment, Supplier, Product, Warehouse, Inventory

client = TestClient(app)


def test_01_get_analysis_overview():
    """1. Test GET /api/v1/analysis/overview returns valid health KPIs and distributions."""
    response = client.get("/api/v1/analysis/overview")
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()

    # Validate structure
    assert "kpis" in data
    kpis = data["kpis"]
    assert "total_shipments" in kpis
    assert "delayed_shipments" in kpis
    assert "high_risk_shipments" in kpis
    assert "active_suppliers" in kpis
    assert "products_below_safety_stock" in kpis
    assert "products_at_risk_of_stockout" in kpis
    assert "data_freshness_timestamp" in kpis

    # Validate distributions
    assert "shipment_risk_distribution" in data
    assert "supplier_risk_distribution" in data
    assert "inventory_status_distribution" in data
    assert "risk_distribution_by_category" in data
    assert "top_risks" in data
    assert isinstance(data["top_risks"], list)


def test_02_get_risk_register():
    """2. Test GET /api/v1/analysis/risks returns paginated risks with filters."""
    response = client.get("/api/v1/analysis/risks?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "risks" in data
    assert "available_categories" in data
    assert "available_severities" in data

    if data["total"] > 0:
        first_risk = data["risks"][0]
        assert "risk_id" in first_risk
        assert "category" in first_risk
        assert "affected_entity_type" in first_risk
        assert "risk_score" in first_risk
        assert "risk_level" in first_risk
        assert first_risk["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert "primary_risk_factors" in first_risk
        assert "potential_business_impact" in first_risk
        assert "recommended_action" in first_risk


def test_03_get_risk_detail():
    """3. Test GET /api/v1/analysis/risks/{risk_id} returns structured breakdown."""
    list_resp = client.get("/api/v1/analysis/risks?page=1&page_size=5")
    assert list_resp.status_code == 200
    data = list_resp.json()

    if data["total"] > 0:
        target_id = data["risks"][0]["risk_id"]
        detail_resp = client.get(f"/api/v1/analysis/risks/{target_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()

        assert "risk" in detail
        assert "observed_facts" in detail
        assert "calculated_metrics" in detail
        assert "potential_consequences" in detail
        assert "suggested_actions" in detail


def test_04_get_risk_detail_not_found():
    """4. Test GET /api/v1/analysis/risks/UNKNOWN-ID returns 404."""
    response = client.get("/api/v1/analysis/risks/RISK-NONEXISTENT-999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_05_get_shipments_analysis():
    """5. Test GET /api/v1/analysis/shipments returns deep shipment risk analysis."""
    response = client.get("/api/v1/analysis/shipments")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "delayed_count" in data
    assert "high_risk_count" in data
    assert "average_delay_days" in data
    assert "items" in data

    for item in data["items"]:
        assert "shipment_id" in item
        assert "risk_score" in item
        assert "risk_level" in item
        assert item["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert "risk_factors" in item
        assert "explanation" in item


def test_06_get_suppliers_analysis():
    """6. Test GET /api/v1/analysis/suppliers returns supplier performance and vulnerability metrics."""
    response = client.get("/api/v1/analysis/suppliers")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "high_risk_count" in data
    assert "single_source_count" in data
    assert "average_reliability" in data
    assert "items" in data

    for item in data["items"]:
        assert "supplier_code" in item
        assert "reliability_score" in item
        assert "on_time_delivery_rate" in item
        assert "risk_score" in item
        assert "risk_level" in item
        assert "explanation" in item


def test_07_get_inventory_analysis():
    """7. Test GET /api/v1/analysis/inventory returns buffer health and stockout exposure."""
    response = client.get("/api/v1/analysis/inventory")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "below_safety_count" in data
    assert "stockout_risk_count" in data
    assert "critical_status_count" in data
    assert "items" in data

    for item in data["items"]:
        assert "sku" in item
        assert "available_units" in item
        assert "safety_stock_units" in item
        assert "buffer_health_percentage" in item
        assert "status" in item
        assert item["status"] in ("optimal", "warning", "critical")
        assert "risk_score" in item
        assert "explanation" in item


def test_08_get_forecasts_analysis():
    """8. Test GET /api/v1/analysis/forecasts combines predictions with inventory positions."""
    response = client.get("/api/v1/analysis/forecasts")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "stockout_predicted_count" in data
    assert "items" in data

    for item in data["items"]:
        assert "sku" in item
        assert "expected_total_demand" in item
        assert "current_available_inventory" in item
        assert "stockout_predicted" in item
        assert "model_version" in item
        assert "data_source" in item


def test_09_scenario_simulation():
    """9. Test POST /api/v1/analysis/simulate evaluates 3-scenario disruption trade-offs."""
    payload = {
        "current_inventory": 500.0,
        "daily_demand": 100.0,
        "shipment_delay_days": 8,
        "original_lead_time_days": 5,
        "replenishment_quantity": 800.0,
        "alternative_supplier_lead_time_days": 4,
        "alternative_procurement_cost_premium_pct": 15.0,
        "expedite_transit_reduction_days": 4,
        "expedite_cost_usd": 1500.0,
        "unit_stockout_penalty_usd": 60.0,
        "unit_cost_usd": 30.0,
        "product_sku": "SKU-SIM-TEST",
    }
    response = client.post("/api/v1/analysis/simulate", json=payload)
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()

    assert "trajectories" in data
    assert len(data["trajectories"]) == 31  # Day 0 to 30
    assert "scenario_a_wait" in data
    assert "scenario_b_alternative" in data
    assert "scenario_c_expedite" in data
    assert "comparison_summary" in data
    assert "advisory_recommendation" in data
    assert "assumptions" in data

    # Verify trajectory data structure
    pt = data["trajectories"][0]
    assert "day" in pt
    assert "scenario_a_wait_stock" in pt
    assert "scenario_b_alt_stock" in pt
    assert "scenario_c_expedite_stock" in pt


def test_10_recommendations_and_lifecycle():
    """10. Test GET /api/v1/analysis/recommendations and PATCH lifecycle updates."""
    # 1. Fetch recommendations
    response = client.get("/api/v1/analysis/recommendations")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert "open_count" in data
    assert "resolved_count" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    first_rec = data["recommendations"][0]
    rec_id = first_rec["recommendation_id"]
    assert "title" in first_rec
    assert "suggested_action" in first_rec
    assert "supporting_evidence" in first_rec
    assert "expected_benefit" in first_rec
    assert "important_trade_offs" in first_rec
    assert "priority" in first_rec
    assert "status" in first_rec

    # 2. Patch status to Reviewed
    patch_payload = {"status": "Reviewed", "notes": "Reviewed by procurement officer."}
    patch_resp = client.patch(f"/api/v1/analysis/recommendations/{rec_id}", json=patch_payload)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "Reviewed"

    # 3. Verify status persistence
    verify_resp = client.get("/api/v1/analysis/recommendations")
    assert verify_resp.status_code == 200
    updated_rec = next(r for r in verify_resp.json()["recommendations"] if r["recommendation_id"] == rec_id)
    assert updated_rec["status"] == "Reviewed"
