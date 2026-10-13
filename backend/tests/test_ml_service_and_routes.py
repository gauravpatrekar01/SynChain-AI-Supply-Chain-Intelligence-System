import asyncio
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_active_user
from app.models.postgres.models import User
from app.core.database import SessionLocal
from app.services.ml.ml_service import MLIntelligenceService
from app.services.health.integration_health_service import IntegrationHealthService

client = TestClient(app)

_cached_test_user = None

def override_auth_user():
    global _cached_test_user
    if _cached_test_user is not None:
        return _cached_test_user
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            user = User(
                name="ML Test Admin",
                email="ml_admin_test@synchain.ai",
                password_hash="mock_hash",
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        _cached_test_user = user
        return _cached_test_user
    finally:
        db.close()


@pytest.fixture(autouse=True)
def apply_auth_override():
    app.dependency_overrides[get_current_active_user] = override_auth_user
    yield
    app.dependency_overrides.pop(get_current_active_user, None)


SAMPLE_SHIPMENT = {
    "supplier_location": "Pune",
    "component_type": "Battery",
    "transport_mode": "Road",
    "distance_km": 450.0,
    "weather_condition": "Rain",
    "seasonal_rainy_period": 1,
    "traffic_level": "High",
    "supplier_risk_rating": "Medium",
    "supplier_on_time_rate": 0.82,
    "supplier_quality_rate": 0.91,
    "supplier_capacity_utilization": 0.85,
    "order_quantity": 500,
    "inventory_at_order": 200,
    "planned_lead_time_days": 5,
    "unit_cost": 250.0,
}


# --- Service Layer Tests ---

def test_ml_service_health():
    health = MLIntelligenceService.check_model_health()
    assert health["status"] == "healthy"
    assert health["model_loaded"] is True
    assert health["features_count"] == 15
    assert health["reference_data_status"]["supplier_master"] is True
    assert health["reference_data_status"]["shipment_history"] is True


def test_ml_service_prediction():
    res = MLIntelligenceService.predict_shipment(SAMPLE_SHIPMENT)
    assert "delay_probability" in res
    assert 0.0 <= res["delay_probability"] <= 1.0
    assert 0.0 <= res["delay_probability_percent"] <= 100.0
    assert res["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert res["model_type"] == "RandomForestClassifier"


def test_ml_service_supplier_recommendation():
    db = SessionLocal()
    try:
        shipment_req = {
            "component_type": "Battery",
            "order_quantity": 500,
            "supplier_location": "Pune",
            "transport_mode": "Road",
        }
        results = MLIntelligenceService.recommend_suppliers(
            shipment=shipment_req,
            max_results=5,
            db=db,
        )
        assert len(results) > 0
        top = results[0]
        assert "supplier_name" in top
        assert "component_type" in top
        assert top["component_type"] == "Battery"
        assert "estimated_delay_probability" in top
        assert "recommendation_score" in top
    finally:
        db.close()


def test_ml_service_simulation():
    combined, summary = MLIntelligenceService.run_inventory_simulation(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=30,
        shipment_quantity=1000,
        component_type="Battery",
    )
    assert not combined.empty
    assert "baseline" in summary
    assert "mitigated" in summary
    assert "automatic_replenishment" in summary
    assert "selected_supplier" in summary


def test_ml_service_decision_report():
    report = MLIntelligenceService.generate_decision_report(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=30,
        shipment_quantity=1000,
        component_type="Battery",
    )
    assert "report_text" in report
    assert "SYNCHAIN AI" in report["report_text"]
    assert "summaries" in report
    assert "selected_supplier" in report
    assert "findings" in report


# --- API Route Tests ---

def test_api_ml_health_public():
    # Public endpoint, verify it succeeds without auth
    resp = client.get("/api/v1/ml/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["features_count"] == 15
    assert data["reference_data_status"]["supplier_master"] is True


def test_api_predict_delay_endpoint():
    resp = client.post("/api/v1/ml/predict-delay", json=SAMPLE_SHIPMENT)
    assert resp.status_code == 200
    data = resp.json()
    assert "delay_probability" in data
    assert 0.0 <= data["delay_probability"] <= 1.0
    assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert data["model_type"] == "RandomForestClassifier"


def test_api_predict_delay_validation_error():
    # Missing required field like component_type
    bad_payload = {"supplier_location": "Pune"}
    resp = client.post("/api/v1/ml/predict-delay", json=bad_payload)
    assert resp.status_code == 422


def test_api_recommend_suppliers_endpoint():
    req_body = {
        "component_type": "Battery",
        "order_quantity": 500,
        "max_results": 4,
    }
    resp = client.post("/api/v1/ml/recommend-suppliers", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["component_type"] == "Battery"
    assert data["order_quantity"] == 500
    assert data["total_eligible"] >= 1
    assert len(data["recommendations"]) <= 4
    if data["recommendations"]:
        first = data["recommendations"][0]
        assert "supplier_name" in first
        assert "estimated_delay_probability" in first


def test_api_simulate_inventory_endpoint():
    req_body = {
        "initial_inventory": 300,
        "daily_demand": 100,
        "simulation_days": 20,
        "shipment_quantity": 800,
        "component_type": "Battery",
    }
    resp = client.post("/api/v1/ml/simulate-inventory", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["daily_records_count"] > 0
    assert "baseline" in data["summary"]
    assert "mitigated" in data["summary"]
    assert "automatic_replenishment" in data["summary"]


def test_api_decision_report_endpoint():
    req_body = {
        "initial_inventory": 300,
        "daily_demand": 100,
        "simulation_days": 30,
        "shipment_quantity": 1000,
        "component_type": "Battery",
    }
    resp = client.post("/api/v1/ml/decision-report", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert "SYNCHAIN AI" in data["report_text"]
    assert "selected_supplier" in data
    assert "summaries" in data


# --- Integration Health Check Tests ---

def test_integration_health_check_ml_model():
    db = SessionLocal()
    try:
        check = asyncio.run(IntegrationHealthService.check_ml_model(db))
        assert check["name"] == "Machine Learning Delay Predictor"
        assert check["category"] == "ai_ml"
        assert check["connection_status"] == "healthy"
        assert check["configuration_status"] == "configured"
        assert check["response_time_ms"] >= 0.0
        assert check["details"]["features_count"] == 15
    finally:
        db.close()


def test_integration_health_check_single_ml():
    db = SessionLocal()
    try:
        check = asyncio.run(IntegrationHealthService.check_single_integration(db, "ml_model", persist=False))
        assert check is not None
        assert check["name"] == "Machine Learning Delay Predictor"
        assert check["connection_status"] == "healthy"
    finally:
        db.close()
