import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_active_user
from app.models.postgres.models import User
from app.core.database import SessionLocal
from app.services.health.integration_health_service import IntegrationHealthService, _sanitize_error_message
from app.services.dashboard.analytics_service import DashboardAnalyticsService

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
                name="Test Dashboard Admin",
                email="admin_test@synchain.ai",
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


# 1. Error Message Sanitizer Tests
def test_sanitize_error_message():
    raw_error = "Connection failed to postgresql://admin:superSecret123@db.prod.io:5432/db"
    sanitized = _sanitize_error_message(raw_error)
    assert "superSecret123" not in sanitized
    assert "***:***@" in sanitized

    key_error = "Unauthorized API access with apikey=abc123xyz789 and token=tok_live_999"
    sanitized_key = _sanitize_error_message(key_error)
    assert "abc123xyz789" not in sanitized_key
    assert "tok_live_999" not in sanitized_key


# 2. Integration Health Endpoints
def test_get_all_integrations_health_unauthorized():
    app.dependency_overrides.pop(get_current_active_user, None)
    res = client.get("/api/v1/integrations/health")
    assert res.status_code == 401
    app.dependency_overrides[get_current_active_user] = override_auth_user


def test_get_all_integrations_health():
    res = client.get("/api/v1/integrations/health")
    assert res.status_code == 200
    data = res.json()
    assert "overall_status" in data
    assert "healthy_count" in data
    assert "integrations" in data
    assert len(data["integrations"]) >= 6

    # Verify no secrets or credentials leaked in any item
    for item in data["integrations"]:
        assert "password" not in str(item).lower()
        assert "superSecret" not in str(item)
        assert item["connection_status"] in ("healthy", "degraded", "unhealthy", "unknown")
        assert item["configuration_status"] in ("configured", "not_configured")


def test_trigger_single_integration_health_check():
    payload = {"integration_name": "OpenWeather"}
    res = client.post("/api/v1/integrations/health/check", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["integrations"]) == 1
    assert data["integrations"][0]["name"] == "OpenWeather API"


def test_get_single_integration_detail_and_history():
    res = client.get("/api/v1/integrations/health/OpenWeather")
    assert res.status_code == 200
    data = res.json()
    assert "integration" in data
    assert "history" in data
    assert data["integration"]["name"] == "OpenWeather API"
    assert isinstance(data["history"], list)


def test_integration_health_unknown_provider():
    res = client.get("/api/v1/integrations/health/NonExistentServiceXYZ")
    assert res.status_code == 404


# 3. Provider-Specific Diagnostic Mock Tests
def test_openweather_auth_failure_handling():
    import asyncio
    db = SessionLocal()
    try:
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 401
            mock_get.return_value = mock_resp

            result = asyncio.run(IntegrationHealthService.check_openweather(db))
            assert result["connection_status"] == "unhealthy"
            assert result["error_category"] == "auth_error"
            assert "401" in result["error_message"]
    finally:
        db.close()


def test_newsdata_rate_limit_handling():
    import asyncio
    db = SessionLocal()
    try:
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 429
            mock_get.return_value = mock_resp

            result = asyncio.run(IntegrationHealthService.check_newsdata(db))
            assert result["connection_status"] == "degraded"
            assert result["error_category"] == "rate_limit"
    finally:
        db.close()


def test_erpnext_timeout_handling():
    import asyncio
    db = SessionLocal()
    try:
        import httpx
        with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Connection timed out")):
            result = asyncio.run(IntegrationHealthService.check_erpnext(db))
            assert result["connection_status"] == "unhealthy"
            assert result["error_category"] == "timeout"
    finally:
        db.close()


def test_cloudinary_storage_health_check():
    import asyncio
    db = SessionLocal()
    try:
        from app.core.config import settings
        original_key = settings.CLOUDINARY_API_KEY
        original_cloud = settings.CLOUDINARY_CLOUD_NAME

        settings.CLOUDINARY_API_KEY = "699585677715957"
        settings.CLOUDINARY_CLOUD_NAME = "demo_supply_chain"

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_get.return_value = mock_resp

            result = asyncio.run(IntegrationHealthService.check_storage(db))
            assert result["name"] == "Cloudinary Cloud Storage"
            assert result["connection_status"] == "healthy"
            assert result["configuration_status"] == "configured"
            assert result["details"]["cloud_name"] == "demo_supply_chain"

        # Test missing cloud_name
        settings.CLOUDINARY_CLOUD_NAME = ""
        result_missing = asyncio.run(IntegrationHealthService.check_storage(db))
        assert result_missing["name"] == "Cloudinary Cloud Storage"
        assert result_missing["connection_status"] == "degraded"
        assert result_missing["error_category"] == "config_missing"

        # Restore
        settings.CLOUDINARY_API_KEY = original_key
        settings.CLOUDINARY_CLOUD_NAME = original_cloud
    finally:
        db.close()


# 4. Real-Data Dashboard Endpoints
def test_dashboard_overview():
    res = client.get("/api/v1/dashboard/overview")
    assert res.status_code == 200
    data = res.json()
    assert "globalRiskIndex" in data
    assert "activeDisruptions" in data
    assert "totalRecordsIngested" in data
    assert "productsCount" in data
    assert "suppliersCount" in data
    assert "warehousesCount" in data
    assert "inventoryUnitsTotal" in data
    assert data["totalRecordsIngested"] >= 0


def test_dashboard_trends():
    res = client.get("/api/v1/dashboard/trends")
    assert res.status_code == 200
    data = res.json()
    assert "ingestionTrend" in data
    assert "inventoryVelocity" in data
    assert "demandForecast" in data
    assert "riskSeverityDistribution" in data
    assert isinstance(data["ingestionTrend"], list)
    assert isinstance(data["inventoryVelocity"], list)


def test_dashboard_risks():
    res = client.get("/api/v1/dashboard/risks")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "entityType" in first
        assert "riskScore" in first
        assert "severity" in first
        assert "contributingFactors" in first
        assert first["severity"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")


def test_dashboard_alerts():
    res = client.get("/api/v1/dashboard/alerts")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if len(data) > 0:
        first = data[0]
        assert "title" in first
        assert "severity" in first
        assert "category" in first


def test_dashboard_recommendations():
    res = client.get("/api/v1/dashboard/recommendations")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "action" in data[0]
    assert "confidence" in data[0]


def test_dashboard_scenario_simulation_non_destructive():
    payload = {
        "scenarioName": "Typhoon Corridors Test",
        "disruptionType": "weather_event",
        "targetEntityId": "hub-memphis",
        "targetEntityName": "Memphis SuperHub",
        "durationDays": 14,
        "severityPct": 60,
        "includeSecondTierCascade": True,
        "autoMitigate": True
    }
    res = client.post("/api/v1/dashboard/scenarios/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "scenarioId" in data
    assert "estimatedRevenueLossUsd" in data
    assert "mitigationStrategies" in data
    assert data["estimatedRevenueLossUsd"] > 0


# 5. Fix Verification: Simulation Route (/simulation and /simulation/history)
def test_simulation_endpoints_resolved():
    payload = {
        "scenarioName": "Port Congestion Simulation",
        "disruptionType": "logistics_delay",
        "targetEntityId": "port-la",
        "targetEntityName": "Port of Los Angeles",
        "durationDays": 10,
        "severityPct": 45,
        "includeSecondTierCascade": True,
        "autoMitigate": True
    }
    # Verify POST /api/v1/simulation returns 200, not 404
    res_post = client.post("/api/v1/simulation", json=payload)
    assert res_post.status_code == 200
    data = res_post.json()
    assert "scenarioId" in data
    assert "financialLossEstimateUsd" in data
    assert "cascadingTimeline" in data

    # Verify GET /api/v1/simulation/history returns 200, not 404
    res_history = client.get("/api/v1/simulation/history")
    assert res_history.status_code == 200
    history = res_history.json()
    assert isinstance(history, list)
    assert len(history) > 0


# 6. Fix Verification: Integration Creation with Frontend System Types (ERP, WMS, CRM, Custom API)
def test_create_integration_frontend_types_no_422():
    # Test 'ERP' system type from Onboarding
    erp_payload = {
        "name": "Production ERP Onboarding Test",
        "system_type": "ERP",
        "base_url": "http://localhost:8080",
        "auth_type": "api_key",
        "api_key": "test_erp_key",
        "api_secret": "test_erp_secret"
    }
    res_erp = client.post("/api/v1/integrations", json=erp_payload)
    assert res_erp.status_code == 201
    assert res_erp.json()["system_type"] == "ERP"

    # Test 'Custom API' system type from Onboarding
    custom_payload = {
        "name": "Custom Logistics API Test",
        "system_type": "Custom API",
        "base_url": "https://api.logistics.com",
        "auth_type": "bearer",
        "api_key": "tok_bearer_123"
    }
    res_custom = client.post("/api/v1/integrations", json=custom_payload)
    assert res_custom.status_code == 201
    assert res_custom.json()["system_type"] == "Custom API"


# 7. Fix Verification: Safe sub claim handling in get_current_user
def test_auth_deps_safe_sub_uuid_and_email():
    from app.core.security import create_access_token
    from app.api.deps import get_current_user
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None

        # 1. Test token with standard UUID sub
        token_uuid = create_access_token(str(user.id))
        user_resolved = get_current_user(db=db, token=token_uuid)
        assert user_resolved.id == user.id

        # 2. Test token with email sub (safely handled without psycopg2 DataError)
        token_email = create_access_token(user.email)
        user_resolved_email = get_current_user(db=db, token=token_email)
        assert user_resolved_email.email == user.email
    finally:
        db.close()


# 8. MongoDB Atlas Integration and Health Checks
def test_mongodb_atlas_health_check_direct():
    import asyncio
    from app.core.config import settings
    if not settings.MONGODB_URL:
        pytest.skip("MONGODB_URL not configured")
    db = SessionLocal()
    try:
        res = asyncio.run(IntegrationHealthService.check_mongodb(db))
        assert res["name"] == "MongoDB Atlas Primary Database"
        assert res["category"] == "database"
        assert res["configuration_status"] == "configured"
        assert res["connection_status"] in ("healthy", "unhealthy")
        assert res["response_time_ms"] > 0
        if res["connection_status"] == "healthy":
            assert "replicaSet" in res["details"]
        else:
            assert res["error_category"] in ("ip_access_denied", "connection_error", "timeout", "auth_error")
    finally:
        db.close()


def test_trigger_mongodb_health_check_endpoint():
    res = client.post("/api/v1/integrations/health/check", json={"integration_name": "MongoDB Atlas"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["integrations"]) == 1
    int_res = data["integrations"][0]
    assert int_res["name"] == "MongoDB Atlas Primary Database"
    assert int_res["connection_status"] in ("healthy", "unhealthy")

