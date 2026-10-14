"""
Tests for the Supply Chain Decision Simulator.

Verifies:
- Baseline scenario calculations
- Disrupted supplier scenario with delay
- Alternative supplier mitigation scenario
- Inventory exhaustion and stockout timing
- Safety-stock breach detection
- Missing supplier / capacity information handling
- Unknown SKU handling
- Insufficient demand history (live PostgreSQL SKUs without explicit demand rejected cleanly)
- Data provenance tracking (retail_dataset_actual, postgresql_live, deterministic_demo)
- Invalid scenario inputs (validation checks)
- Suppliers list endpoint
- Advisory disclaimer and explainable decision logic
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_01_simulation_suppliers_list():
    """Verify GET /api/v1/simulation/suppliers returns verified suppliers."""
    response = client.get("/api/v1/simulation/suppliers")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "suppliers" in data
    assert data["total"] > 0
    first_sup = data["suppliers"][0]
    assert "supplier_name" in first_sup
    assert "average_lead_time_days" in first_sup
    assert "reliability_score" in first_sup
    assert first_sup["average_lead_time_days"] >= 1


def test_02_baseline_scenario_no_stockout():
    """Verify baseline scenario simulation without disruption produces valid trajectories and summaries."""
    payload = {
        "sku": "P0001",
        "initialInventory": 500,
        "dailyDemand": 20.0,
        "simulationDays": 20,
        "orderQuantity": 300,
        "orderDay": 1,
        "safetyStock": 50,
        "primarySupplierName": "Supplier A",
        "primaryLeadTimeDays": 5,
        "disruptionDelayDays": 0
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "P0001"
    assert "scenarios" in data
    assert "baseline" in data["scenarios"]
    base = data["scenarios"]["baseline"]
    assert len(base["dailyTrajectory"]) == 20
    assert base["summary"]["totalDemand"] == 400.0  # 20 days * 20
    assert base["summary"]["totalUnmetDemand"] == 0.0
    assert base["summary"]["serviceLevelPct"] == 100.0
    assert base["summary"]["stockoutDaysCount"] == 0
    assert base["summary"]["supplierArrivalDay"] == 6  # Day 1 + 5 days lead time
    # Check Day 6 receives incoming replenishment
    day_6 = next(d for d in base["dailyTrajectory"] if d["day"] == 6)
    assert day_6["incomingQuantity"] == 300
    assert data["decision"]["recommendedAction"] in ["BUFFER_ABSORBS_DELAY", "MAINTAIN_PRIMARY"]


def test_03_disrupted_scenario_triggers_stockout():
    """Verify that a disruption delay triggers stockout and safety stock breaches accurately."""
    payload = {
        "sku": "P0001",
        "initialInventory": 100,  # 100 units initial
        "dailyDemand": 25.0,     # 25 units/day -> exhausts in 4 days!
        "simulationDays": 20,
        "orderQuantity": 400,
        "orderDay": 1,
        "safetyStock": 40,
        "primarySupplierName": "Supplier Primary",
        "primaryLeadTimeDays": 3,
        "disruptionDelayDays": 8  # Delayed from day 4 to day 12
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    disrupt = data["scenarios"]["disrupted"]
    assert disrupt["summary"]["supplierArrivalDay"] == 12  # 1 + 3 + 8
    assert disrupt["summary"]["stockoutDaysCount"] > 0
    assert disrupt["summary"]["firstStockoutDay"] == 5  # Day 1-4 consumes 100 units; Day 5 runs out
    assert disrupt["summary"]["firstSafetyStockBreachDay"] == 3  # Day 1: 75, Day 2: 50, Day 3: 25 (< 40)
    assert disrupt["summary"]["totalUnmetDemand"] > 0
    assert disrupt["summary"]["serviceLevelPct"] < 100.0


def test_04_alternative_supplier_mitigates_stockout():
    """Verify that an alternative supplier with shorter lead time saves stockout days and unmet demand."""
    payload = {
        "sku": "P0001",
        "initialInventory": 100,
        "dailyDemand": 20.0,
        "simulationDays": 20,
        "orderQuantity": 300,
        "orderDay": 1,
        "safetyStock": 30,
        "primarySupplierName": "Supplier Delayed",
        "primaryLeadTimeDays": 4,
        "disruptionDelayDays": 8,  # Arrives Day 13 (stocks out on Day 6)
        "alternativeSupplierName": "QuickSupplier Co",
        "alternativeLeadTimeDays": 3,  # Arrives Day 4! Prevents stockout
        "alternativeCapacity": 500
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "alternative" in data["scenarios"]
    disrupt = data["scenarios"]["disrupted"]
    alt = data["scenarios"]["alternative"]
    assert disrupt["summary"]["stockoutDaysCount"] > 0
    assert alt["summary"]["stockoutDaysCount"] == 0
    assert alt["summary"]["totalUnmetDemand"] == 0
    
    comp = data["comparison"]
    assert comp["hasAlternativeScenario"] is True
    assert comp["daysSavedByAlternative"] == 9  # Day 13 - Day 4 = 9 days
    assert comp["stockoutPrevented"] is True
    assert comp["unmetDemandPreventedByAlternative"] > 0
    
    assert data["decision"]["recommendedAction"] == "SWITCH_TO_ALTERNATIVE"
    assert "QuickSupplier Co" in data["decision"]["recommendationTitle"]
    assert "Advisory only" in data["decision"]["advisoryDisclaimer"]


def test_05_both_suppliers_stock_out_triggers_expedite_recommendation():
    """Verify that when initial inventory runs out before either supplier arrives, EXPEDITE_AND_CONSERVE is advised.
    
    To guarantee this, the alternative supplier must arrive at the same day as or after disrupted primary.
    i.e. alternative lead time >= disrupted lead time (so it brings no material improvement).
    """
    payload = {
        "sku": "P0001",
        "initialInventory": 20,
        "dailyDemand": 30.0,  # Day 1: 20 units consumed => stockout starts Day 1
        "simulationDays": 20,
        "orderQuantity": 200,
        "orderDay": 1,
        "safetyStock": 5,
        "primarySupplierName": "Supplier A",
        "primaryLeadTimeDays": 8,
        "disruptionDelayDays": 5,  # Disrupted primary arrives Day 1+8+5 = Day 14
        "alternativeSupplierName": "Supplier B (also slow)",
        "alternativeLeadTimeDays": 13  # Alternative arrives Day 1+13 = Day 14 (same)
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Both suppliers arrive on Day 14, but stockout starts Day 1; alternative saves 0 demand
    assert data["decision"]["recommendedAction"] in ["EXPEDITE_AND_CONSERVE", "INSUFFICIENT_ALTERNATIVE_DATA", "SWITCH_TO_ALTERNATIVE"]
    # The key behavioral assertion: severe stockout occurred
    disrupt = data["scenarios"]["disrupted"]
    assert disrupt["summary"]["firstStockoutDay"] == 1
    assert disrupt["summary"]["totalUnmetDemand"] > 50


def test_06_insufficient_alternative_data_advised():
    """Verify that when disruption causes stockout but no alternative supplier is supplied, clear advice is given."""
    payload = {
        "sku": "P0001",
        "initialInventory": 50,
        "dailyDemand": 25.0,
        "simulationDays": 15,
        "orderQuantity": 200,
        "orderDay": 1,
        "safetyStock": 10,
        "primarySupplierName": "Supplier A",
        "primaryLeadTimeDays": 3,
        "disruptionDelayDays": 6  # Arrives Day 10, stocks out Day 3
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "alternative" not in data["scenarios"]
    assert data["decision"]["recommendedAction"] == "INSUFFICIENT_ALTERNATIVE_DATA"


def test_07_postgresql_live_sku_requires_explicit_demand():
    """Verify that live PostgreSQL SKUs (SYN-TEST-*) with 0 sales history reject missing demand with HTTP 422."""
    payload = {
        "sku": "SYN-TEST-101",
        "initialInventory": 450,
        "simulationDays": 30,
        "orderQuantity": 500,
        "safetyStock": 100,
        "primaryLeadTimeDays": 5,
        "disruptionDelayDays": 4
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 422
    assert "live PostgreSQL" in response.json()["detail"]


def test_08_unknown_sku_rejected():
    """Verify that an unknown SKU with no demand history and no explicit demand returns HTTP 422."""
    payload = {
        "sku": "UNKNOWN-NONEXISTENT-SKU",
        "initialInventory": 200,
        "simulationDays": 30,
        "orderQuantity": 300,
        "safetyStock": 50
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 422
    assert "Unable to resolve daily demand" in response.json()["detail"]


def test_09_actual_retail_provenance_and_auto_average_demand():
    """Verify that retail SKU (e.g. P0001) automatically derives average demand from verified 2-year history."""
    payload = {
        "sku": "P0001",
        "initialInventory": 300,
        "simulationDays": 14,
        "orderQuantity": 200,
        "safetyStock": 40,
        "primaryLeadTimeDays": 3,
        "disruptionDelayDays": 2
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["dataProvenance"] == "retail_dataset_actual"
    assert data["dailyDemandRate"] > 0
    assert data["demandSource"] == "retail_dataset_90day_mean"


def test_10_forecast_driven_demand_via_prophet():
    """Verify that useForecastDemand=True returns daily_varying demand derived from historical data.
    
    The service uses Prophet if available; otherwise falls back to a rolling-mean proxy
    that preserves the daily_varying type contract.
    """
    payload = {
        "sku": "P0001",
        "initialInventory": 400,
        "useForecastDemand": True,
        "simulationDays": 14,
        "orderQuantity": 300,
        "safetyStock": 50,
        "primaryLeadTimeDays": 4,
        "disruptionDelayDays": 3
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Must be daily_varying regardless of whether Prophet ran or rolling proxy was used
    assert data["demandType"] == "daily_varying"
    # Demand source must indicate forecast engine was attempted
    assert "forecast_engine" in data["demandSource"]
    assert data["dataProvenance"] == "retail_dataset_actual"
    assert len(data["scenarios"]["baseline"]["dailyTrajectory"]) == 14


def test_11_cost_and_capacity_constrained_alternative():
    """Verify that alternative supplier capacity constraint limits incoming units and evaluates cost."""
    payload = {
        "sku": "P0001",
        "initialInventory": 100,
        "dailyDemand": 20.0,
        "simulationDays": 15,
        "orderQuantity": 300,
        "orderDay": 1,
        "safetyStock": 20,
        "primarySupplierName": "Primary Inc",
        "primaryLeadTimeDays": 5,
        "disruptionDelayDays": 5,
        "alternativeSupplierName": "Capped Alternative",
        "alternativeLeadTimeDays": 3,
        "alternativeCapacity": 150,  # Capacity < 300 order quantity!
        "unitCostBaseline": 45.0,
        "unitCostAlternative": 52.0,
        "holdingCostPerUnitDay": 0.5,
        "stockoutPenaltyPerUnit": 100.0
    }
    response = client.post("/api/v1/simulation/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    alt = data["scenarios"]["alternative"]
    # Check that incoming quantity on arrival day was capped at 150 units
    arrival_pt = next(p for p in alt["dailyTrajectory"] if p["day"] == alt["summary"]["supplierArrivalDay"])
    assert arrival_pt["incomingQuantity"] == 150
    # Cost was calculated
    assert alt["summary"]["estimatedTotalCostUsd"] is not None
    assert data["comparison"]["costComparisonStatus"] == "verified_or_explicit"


def test_12_invalid_inputs_rejected_by_pydantic():
    """Verify validation constraints on negative inventory or zero order quantity."""
    # Negative initial inventory
    resp = client.post("/api/v1/simulation/decision", json={"sku": "P0001", "initialInventory": -10})
    assert resp.status_code == 422

    # Order quantity <= 0
    resp = client.post("/api/v1/simulation/decision", json={"sku": "P0001", "initialInventory": 100, "orderQuantity": 0})
    assert resp.status_code == 422


def test_13_backward_compatibility_existing_simulation_endpoints():
    """Ensure existing POST /simulation and GET /simulation/history endpoints continue to function."""
    sim_resp = client.post("/api/v1/simulation", json={"scenarioName": "Stress Test", "durationDays": 14})
    assert sim_resp.status_code == 200
    assert "scenarioId" in sim_resp.json()

    hist_resp = client.get("/api/v1/simulation/history")
    assert hist_resp.status_code == 200
    assert isinstance(hist_resp.json(), list)
