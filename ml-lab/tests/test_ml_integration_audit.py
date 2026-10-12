import importlib
import sys
from pathlib import Path


def _module_names():
    return ["predict", "recommend_supplier", "simulation", "decision_report"]


def test_ml_modules_import_safely_without_cwd_dependency(monkeypatch, tmp_path):
    src_dir = Path(__file__).resolve().parents[1] / "src"
    if str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))

    monkeypatch.chdir(tmp_path)

    for module_name in _module_names():
        sys.modules.pop(module_name, None)

    modules = [importlib.import_module(name) for name in _module_names()]

    assert hasattr(modules[0], "predict_shipment")
    assert hasattr(modules[1], "recommend_suppliers")
    assert hasattr(modules[2], "run_simulation")
    assert hasattr(modules[3], "generate_decision_report")


def test_prediction_response_has_stable_structure():
    predict = importlib.import_module("predict")

    sample = {
        "supplier_location": "Pune",
        "component_type": "Battery",
        "transport_mode": "Road",
        "distance_km": 450,
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

    result = predict.predict_shipment(sample)

    assert set(result) == {
        "delay_probability",
        "delay_probability_percent",
        "risk_level",
        "model_type",
        "data_source",
        "production_ready",
    }
    assert 0.0 <= result["delay_probability"] <= 1.0
    assert result["data_source"] == "synthetic_development_data"
    assert result["production_ready"] is False


def test_recommendation_and_simulation_return_structured_values():
    recommend_supplier = importlib.import_module("recommend_supplier")
    simulation = importlib.import_module("simulation")

    shipment = {
        "supplier_location": "Pune",
        "component_type": "Battery",
        "transport_mode": "Road",
        "distance_km": 450,
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

    recommendations = recommend_supplier.recommend_suppliers(shipment, max_results=3)
    assert isinstance(recommendations, list)
    assert recommendations
    assert all("supplier_id" in item for item in recommendations)
    assert all("recommendation_score" in item for item in recommendations)

    combined, summary = simulation.run_simulation(
        initial_inventory=300,
        daily_demand=100,
        simulation_days=8,
        shipment_quantity=500,
    )

    assert "scenario" in combined.columns
    assert set(summary) >= {"baseline", "mitigated", "automatic_replenishment", "selected_supplier"}
