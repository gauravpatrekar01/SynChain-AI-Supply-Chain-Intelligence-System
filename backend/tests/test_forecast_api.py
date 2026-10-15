"""
Integration test suite for SynChain AI Forecast Engine & Inventory Decision API.
Tests end-to-end HTTP interactions, Pydantic validation, pipeline compatibility,
and safe error handling.
"""

import json
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_HISTORICAL_DATA = [
    {"date": f"2026-01-{i:02d}", "demand": float(100 + (i % 7) * 5 + i)}
    for i in range(1, 25)
]


def test_01_successful_demand_forecast():
    """1. Test successful demand forecast with metrics and intervals."""
    payload = {
        "productId": "SKU-TEST-001",
        "historicalData": SAMPLE_HISTORICAL_DATA,
        "horizonDays": 14,
        "intervalWidth": 0.95,
        "evaluate": True,
    }
    response = client.post("/api/v1/forecast/demand", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert data["status"] == "success"
    assert data["productId"] == "SKU-TEST-001"
    assert data["horizon"] == 14
    assert len(data["forecast"]) == 14
    assert "algorithm" in data
    assert "modelVersion" in data
    assert "metrics" in data

    # Verify forecast point structure meets frontend contract
    first_pt = data["forecast"][0]
    assert "date" in first_pt
    assert "predictedDemandUnits" in first_pt
    assert "confidenceLower" in first_pt
    assert "confidenceUpper" in first_pt
    assert first_pt["confidenceUpper"] >= first_pt["predictedDemandUnits"]
    assert first_pt["confidenceLower"] <= first_pt["predictedDemandUnits"]
    assert first_pt["confidenceLower"] >= 0.0


def test_02_invalid_historical_data():
    """2. Test invalid historical data rejection (422 Unprocessable Entity)."""
    # Empty historical data
    response = client.post(
        "/api/v1/forecast/demand",
        json={"productId": "SKU-ERR", "historicalData": [], "horizonDays": 7},
    )
    assert response.status_code == 422

    # Malformed historical data (fewer than min_points)
    response2 = client.post(
        "/api/v1/forecast/demand",
        json={
            "productId": "SKU-ERR",
            "historicalData": [{"date": "2026-01-01", "demand": 100}],
            "horizonDays": 7,
        },
    )
    assert response2.status_code == 422


def test_03_invalid_horizon():
    """3. Test invalid horizon rejection (422 Unprocessable Entity)."""
    # Zero horizon
    response = client.post(
        "/api/v1/forecast/demand",
        json={
            "productId": "SKU-ERR",
            "historicalData": SAMPLE_HISTORICAL_DATA,
            "horizonDays": 0,
        },
    )
    assert response.status_code == 422

    # Negative horizon
    response2 = client.post(
        "/api/v1/forecast/demand",
        json={
            "productId": "SKU-ERR",
            "historicalData": SAMPLE_HISTORICAL_DATA,
            "horizonDays": -10,
        },
    )
    assert response2.status_code == 422


def test_04_forecast_response_json_serialization():
    """4. Test that forecast response serializes strictly as valid JSON with no NaNs/Infs."""
    payload = {
        "productId": "SKU-JSON-TEST",
        "historicalData": SAMPLE_HISTORICAL_DATA,
        "horizonDays": 7,
        "intervalWidth": 0.95,
        "evaluate": True,
    }
    response = client.post("/api/v1/forecast/demand", json=payload)
    assert response.status_code == 200

    # Ensure json.dumps succeeds without NaN or custom object serialization errors
    json_str = json.dumps(response.json())
    assert isinstance(json_str, str)
    assert "NaN" not in json_str
    assert "Infinity" not in json_str


def test_05_forecast_endpoint_backward_compatibility():
    """5. Test legacy POST /api/v1/forecast endpoint backward compatibility."""
    payload = {
        "productId": "LEGACY-PROD-99",
        "historicalData": SAMPLE_HISTORICAL_DATA[:15],
        "horizonDays": 5,
    }
    response = client.post("/api/v1/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "forecast" in data
    assert len(data["forecast"]) == 5
    assert data["horizon"] == 5
    assert "model_version" in data or "modelVersion" in data


def test_06_successful_inventory_reorder_calculation():
    """6. Test successful inventory reorder calculation with parametric variance."""
    payload = {
        "productId": "SKU-INV-001",
        "forecastPoints": [120.0, 125.0, 130.0, 115.0, 120.0, 135.0, 140.0],
        "leadTimeDays": 5,
        "targetServiceLevel": 0.95,
        "leadTimeStdDays": 0.0,
        "dailyForecastRmse": 14.5,
        "holdingCostPerUnit": 2.5,
        "stockoutCostPerUnit": 25.0,
    }
    response = client.post("/api/v1/inventory/reorder-policy", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "success"
    assert data["productId"] == "SKU-INV-001"
    assert data["leadTimeDays"] == 5
    # Expected lead-time demand: 120 + 125 + 130 + 115 + 120 = 610.0
    assert data["expectedLeadTimeDemand"] == 610.0
    assert data["safetyStock"] > 0.0
    assert data["reorderPoint"] == round(data["expectedLeadTimeDemand"] + data["safetyStock"], 2)
    assert data["methodUsed"] == "parametric_analytic"
    assert data["criticalFractile"] == round(25.0 / (25.0 + 2.5), 4)
    assert "leadTimeDemandBounds" in data
    assert data["leadTimeDemandBounds"]["upper"] >= data["expectedLeadTimeDemand"]
    assert len(data["assumptions"]) >= 2


def test_07_invalid_lead_time():
    """7. Test invalid lead time rejection (422 Unprocessable Entity)."""
    payload = {
        "productId": "SKU-INV-ERR",
        "forecastPoints": [100.0, 100.0, 100.0],
        "leadTimeDays": 0,
        "targetServiceLevel": 0.95,
        "dailyForecastRmse": 10.0,
    }
    response = client.post("/api/v1/inventory/reorder-policy", json=payload)
    assert response.status_code == 422


def test_08_invalid_service_level():
    """8. Test invalid service level rejection (422 Unprocessable Entity)."""
    # Service level <= 0.50
    response = client.post(
        "/api/v1/inventory/reorder-policy",
        json={
            "productId": "SKU-INV-ERR",
            "forecastPoints": [100.0, 100.0, 100.0],
            "leadTimeDays": 2,
            "targetServiceLevel": 0.40,
            "dailyForecastRmse": 10.0,
        },
    )
    assert response.status_code == 422

    # Service level >= 1.00
    response2 = client.post(
        "/api/v1/inventory/reorder-policy",
        json={
            "productId": "SKU-INV-ERR",
            "forecastPoints": [100.0, 100.0, 100.0],
            "leadTimeDays": 2,
            "targetServiceLevel": 1.05,
            "dailyForecastRmse": 10.0,
        },
    )
    assert response2.status_code == 422


def test_09_forecast_to_inventory_response_compatibility():
    """9. Pipeline test: Ensure inventory reorder policy directly accepts forecast endpoint output."""
    # Step A: Generate demand forecast
    forecast_payload = {
        "productId": "SKU-PIPELINE-01",
        "historicalData": SAMPLE_HISTORICAL_DATA,
        "horizonDays": 10,
        "intervalWidth": 0.95,
        "evaluate": True,
    }
    forecast_resp = client.post("/api/v1/forecast/demand", json=forecast_payload)
    assert forecast_resp.status_code == 200
    forecast_data = forecast_resp.json()

    # Step B: Feed the forecast points directly to inventory policy without schema modification
    inventory_payload = {
        "productId": forecast_data["productId"],
        "forecastPoints": forecast_data["forecast"],  # List of dicts directly from forecast response
        "leadTimeDays": 5,
        "targetServiceLevel": 0.95,
        "dailyForecastRmse": forecast_data["metrics"].get("rmse") or 12.0,
        "holdingCostPerUnit": 1.5,
        "stockoutCostPerUnit": 15.0,
    }
    inv_resp = client.post("/api/v1/inventory/reorder-policy", json=inventory_payload)
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()

    assert inv_data["status"] == "success"
    assert inv_data["productId"] == "SKU-PIPELINE-01"
    assert inv_data["leadTimeDays"] == 5
    assert inv_data["expectedLeadTimeDemand"] > 0.0
    assert inv_data["safetyStock"] > 0.0
    assert inv_data["reorderPoint"] > inv_data["expectedLeadTimeDemand"]


def test_10_forecasting_failure_returns_clean_http_error():
    """10. Test that internal forecast failure returns HTTP 500 without leaking tracebacks."""
    payload = {
        "productId": "SKU-FAIL",
        "historicalData": SAMPLE_HISTORICAL_DATA,
        "horizonDays": 7,
    }
    with patch(
        "app.services.forecasting.prophet_forecast.ForecastingService.generate_demand_forecast",
        side_effect=RuntimeError("Internal matrix decomposition singular error at line 402 in /private/secret/path"),
    ):
        response = client.post("/api/v1/forecast/demand", json=payload)
        assert response.status_code == 500
        error_detail = response.json()["detail"]
        # Ensure clean client message and no internal stack trace or filesystem paths exposed
        assert "private" not in error_detail
        assert "secret" not in error_detail
        assert "Traceback" not in error_detail
        assert "Forecasting computation failed" in error_detail


def test_11_forecast_health():
    """11. Test forecast health check endpoint."""
    response = client.get("/api/v1/forecast/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "nominal"
    assert data["ready"] is True
    assert "prophetVersion" in data
    assert len(data["availableAlgorithms"]) >= 3


def test_12_get_inventory_items():
    """12. Test GET /api/v1/inventory/items returns items with data source labeling."""
    from app.core.database import SessionLocal
    from app.models.postgres.models import Product, Warehouse, Inventory
    with SessionLocal() as db:
        p = db.query(Product).filter(Product.sku == "SYN-TEST-101").first()
        if not p:
            p = Product(sku="SYN-TEST-101", name="Titanium Bracket", category="Aerospace", price=120.50)
            w = Warehouse(name="Austin Hub", location="Austin, TX", country="US", capacity_units=10000)
            db.add_all([p, w])
            db.flush()
            inv = Inventory(product_id=p.id, warehouse_id=w.id, stock_quantity=150)
            db.add(inv)
            db.commit()

    response = client.get("/api/v1/inventory/items")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    # Check structure
    for item in data:
        assert "sku" in item
        assert "name" in item
        assert "currentStock" in item
        assert "dataSource" in item
        assert item["dataSource"] in ("postgresql_live", "retail_dataset_actual", "deterministic_demo")

    # Confirm presence of live postgresql items and retail actual items
    skus = [i["sku"] for i in data]
    assert "SYN-TEST-101" in skus
    assert "P0001" in skus
    assert "IC-3NM-A18" in skus


def test_13_get_demand_history_actual_retail_sku():
    """13. Test GET /api/v1/forecast/demand-history/{sku} with verified retail actual data."""
    response = client.get("/api/v1/forecast/demand-history/P0001")
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "P0001"
    assert data["dataSource"] == "retail_dataset_actual"
    assert data["isSimulated"] is False
    assert data["totalObservations"] > 0
    assert len(data["historicalData"]) == data["totalObservations"]
    assert "demand" in data["historicalData"][0]
    assert "date" in data["historicalData"][0]


def test_14_get_demand_history_demo_sku():
    """14. Test GET /api/v1/forecast/demand-history/{sku} for explicitly labeled demo product."""
    response = client.get("/api/v1/forecast/demand-history/IC-3NM-A18")
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "IC-3NM-A18"
    assert data["dataSource"] == "deterministic_demo"
    assert data["isSimulated"] is True
    assert data["totalObservations"] == 30


def test_15_get_demand_history_postgresql_sku_rejected():
    """15. Test that live database product with no sales history cleanly returns 422 without faking data."""
    from app.core.database import SessionLocal
    from app.models.postgres.models import Product
    with SessionLocal() as db:
        p = db.query(Product).filter(Product.sku == "SYN-TEST-101").first()
        if not p:
            p = Product(sku="SYN-TEST-101", name="Titanium Bracket", category="Aerospace", price=120.50)
            db.add(p)
            db.commit()

    response = client.get("/api/v1/forecast/demand-history/SYN-TEST-101")
    assert response.status_code == 422
    data = response.json()
    assert "insufficient historical demand observations" in data["detail"].lower()
    assert "never silently substitutes synthetic data" in data["detail"].lower()


def test_16_get_demand_history_unknown_sku():
    """16. Test that unknown SKU returns 404 Not Found."""
    response = client.get("/api/v1/forecast/demand-history/UNKNOWN-SKU-XYZ-999")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_17_inventory_reorder_policy_with_current_stock():
    """17. Test reorder policy calculation incorporating on-hand stock and recommended reorder quantity."""
    # Scenario A: Low stock triggers replenishment recommendation
    payload_reorder_needed = {
        "productId": "P0001",
        "forecastPoints": [100.0] * 30,
        "leadTimeDays": 7,
        "targetServiceLevel": 0.95,
        "dailyForecastRmse": 15.0,
        "currentStock": 200.0,  # Below ROP (~765)
    }
    resp_a = client.post("/api/v1/inventory/reorder-policy", json=payload_reorder_needed)
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["currentStock"] == 200.0
    assert data_a["reorderRequired"] is True
    assert data_a["recommendedReorderQuantity"] > 0.0

    # Scenario B: High stock requires no reorder
    payload_reorder_not_needed = {
        "productId": "P0001",
        "forecastPoints": [100.0] * 30,
        "leadTimeDays": 7,
        "targetServiceLevel": 0.95,
        "dailyForecastRmse": 15.0,
        "currentStock": 2000.0,  # Well above ROP (~765)
    }
    resp_b = client.post("/api/v1/inventory/reorder-policy", json=payload_reorder_not_needed)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["currentStock"] == 2000.0
    assert data_b["reorderRequired"] is False
    assert data_b["recommendedReorderQuantity"] == 0.0

