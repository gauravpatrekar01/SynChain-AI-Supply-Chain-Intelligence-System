import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "nominal"

def test_dashboard_kpis():
    response = client.get("/api/v1/dashboard/kpis")
    assert response.status_code == 200
    data = response.json()
    assert "globalRiskIndex" in data
    assert "activeDisruptions" in data

def test_digital_twin_topology():
    response = client.get("/api/v1/digital-twin")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data

def test_generate_forecast():
    payload = {
        "productId": "prod-1",
        "historicalData": [{"date": f"2026-01-{i:02d}", "demand": 100 + i} for i in range(1, 15)],
        "horizonDays": 3
    }
    response = client.post("/api/v1/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "forecast" in data
    assert len(data["forecast"]) == 3
    
def test_simulation():
    payload = {
        "scenarioName": "Test Scenario",
        "disruptionType": "custom",
        "targetEntityId": "entity-1",
        "targetEntityName": "Target",
        "durationDays": 10,
        "severityPct": 50,
        "includeSecondTierCascade": True,
        "autoMitigate": True
    }
    response = client.post("/api/v1/scenarios/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "financialLossEstimateUsd" in data
    assert "mitigationStrategies" in data

def test_copilot_chat():
    payload = {
        "message": "What is the risk?",
        "context": {"entityName": "Test Entity", "currentRiskScore": 50}
    }
    response = client.post("/api/v1/copilot/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "text" in data
    assert "sender" in data
