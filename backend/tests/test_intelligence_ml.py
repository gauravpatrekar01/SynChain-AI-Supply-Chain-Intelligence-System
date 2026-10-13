from contextlib import nullcontext
from datetime import date, timedelta
from types import SimpleNamespace

import numpy as np

from app.services.intelligence import ml_analysis


def _shipment_row():
    return {
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


class _FakeClassifier:
    classes_ = [0, 1]


class _FakeDelayModel:
    feature_names_in_ = list(ml_analysis.DELAY_FEATURES)
    named_steps = {"classifier": _FakeClassifier()}

    def predict_proba(self, _frame):
        return [[0.2, 0.8]]


def test_delay_prediction_requires_all_explicit_artifact_features(monkeypatch):
    monkeypatch.setattr(ml_analysis, "_get_delay_model", lambda: _FakeDelayModel())
    result = ml_analysis._run_delay_predictions({"erp": {"rows": [_shipment_row()]}})

    assert result["status"] == "completed"
    assert result["predictions"][0]["delay_probability"] == 0.8
    assert result["provenance"]["data_source"] == "synthetic_development_data"
    assert result["provenance"]["production_ready"] is False

    monkeypatch.setattr(
        ml_analysis,
        "_get_delay_model",
        lambda: (_ for _ in ()).throw(AssertionError("model must not load")),
    )
    incomplete = _shipment_row()
    incomplete.pop("component_type")
    skipped = ml_analysis._run_delay_predictions({"erp": {"rows": [incomplete]}})
    assert skipped["status"] == "skipped_insufficient_data"
    assert skipped["missing_features"] == ["component_type"]


class _FakeValue:
    def __init__(self, value):
        self.value = value

    def item(self):
        return self.value


class _FakeScores(list):
    def __getitem__(self, index):
        return _FakeValue(super().__getitem__(index))


def test_distilbert_classification_uses_only_uploaded_narrative(monkeypatch):
    class FakeModel:
        config = SimpleNamespace(id2label={0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"})

        def eval(self):
            return None

        def __call__(self, **_inputs):
            return SimpleNamespace(logits=[[0.1, 0.2, 0.6, 0.1]])

    class FakeTokenizer:
        def __call__(self, text, **kwargs):
            assert "Late supplier delivery" in text
            assert kwargs["truncation"] is True
            return {"input_ids": [1, 2]}

    fake_torch = SimpleNamespace(
        inference_mode=nullcontext,
        softmax=lambda _logits, dim: _FakeScores([0.1, 0.2, 0.6, 0.1]),
        argmax=lambda _scores: _FakeValue(2),
    )
    monkeypatch.setattr(
        ml_analysis,
        "_get_text_components",
        lambda: (FakeTokenizer(), FakeModel(), fake_torch),
    )

    skipped = ml_analysis._run_text_risk({"erp": {"rows": [{"supplier_name": "A"}]}})
    assert skipped["status"] == "skipped_insufficient_data"

    result = ml_analysis._run_text_risk({
        "erp": {"rows": [{"risk_description": "Late supplier delivery"}]}
    })
    assert result["status"] == "completed"
    assert result["predictions"][0]["predicted_label"] == "HIGH"
    assert result["predictions"][0]["score_is_calibrated"] is False
    assert "text" not in result["predictions"][0]


def test_chronos_requires_complete_daily_history_and_returns_quantiles(monkeypatch):
    start = date(2025, 1, 1)
    rows = [
        {
            "warehouse_id": "W1",
            "product_id": "P1",
            "observation_date": (start + timedelta(days=index)).isoformat(),
            "daily_demand": 10 + index,
        }
        for index in range(ml_analysis.FORECAST_MIN_DAILY_OBSERVATIONS)
    ]

    class FakePipeline:
        def predict(self, context, prediction_length):
            assert len(context) == ml_analysis.FORECAST_MIN_DAILY_OBSERVATIONS
            assert prediction_length == 7
            base = np.arange(7, dtype=float)
            return np.asarray([[base, base + 10, base + 20]])

    fake_torch = SimpleNamespace(
        tensor=lambda values, dtype=None: np.asarray(values),
        float32=np.float32,
        quantile=lambda samples, quantiles, dim: np.quantile(
            samples, quantiles, axis=dim
        ),
    )
    monkeypatch.setattr(
        ml_analysis,
        "_get_chronos_components",
        lambda: (FakePipeline(), fake_torch),
    )

    missing_dates = rows.copy()
    missing_dates.pop(5)
    missing_dates.append({
        "warehouse_id": "W1",
        "product_id": "P1",
        "observation_date": (start + timedelta(days=30)).isoformat(),
        "daily_demand": 40,
    })
    skipped = ml_analysis._run_demand_forecasts({"wms": {"rows": missing_dates}})
    assert skipped["status"] == "skipped_insufficient_data"
    assert "missing dates" in skipped["skipped_series"][0]

    result = ml_analysis._run_demand_forecasts({"wms": {"rows": rows}})
    assert result["status"] == "completed"
    assert result["frequency"] == "daily"
    assert result["horizon_days"] == 7
    assert result["forecasts"][0]["forecast"][0] == {
        "date": "2025-01-31",
        "lower_80": 2.0,
        "median": 10.0,
        "upper_80": 18.0,
    }


def test_explicit_simulation_is_pure_and_json_safe():
    result = ml_analysis._run_scenario_simulation({
        "wms": {
            "rows": [{
                "current_stock": 50.0,
                "daily_demand": 10.0,
                "scenario_horizon_days": 8.0,
                "simulation_shipment_quantity": 100.0,
                "baseline_lead_time_days": 5.0,
                "mitigated_lead_time_days": 2.0,
            }]
        }
    })
    assert result["status"] == "completed"
    assert set(result["scenarios"]) == {"baseline", "mitigation_assumption"}
    assert result["assumptions"]["mitigation_is_a_user_supplied_assumption"] is True
    assert isinstance(result["scenarios"]["baseline"]["daily_results"], list)

    skipped = ml_analysis._run_scenario_simulation({"wms": {"rows": []}})
    assert skipped["status"] == "skipped_insufficient_data"


def test_uploaded_supplier_recommendations_never_fall_back_to_demo_catalog(monkeypatch):
    monkeypatch.setattr(ml_analysis, "_get_delay_model", lambda: _FakeDelayModel())
    shipment = _shipment_row()
    profile = {
        "supplier_id": "S1",
        "supplier_name": "Uploaded Supplier",
        "location": "Pune",
        "component_types": "Battery",
        "average_lead_time_days": 4.0,
        "on_time_delivery_rate": 0.92,
        "quality_rate": 0.95,
        "unit_cost_index": 100.0,
        "available_capacity_units": 1000.0,
        "distance_from_warehouse_km": 200.0,
        "active": 1.0,
    }
    row = {**shipment, **profile}
    result = ml_analysis._supplier_recommendations({"erp": {"rows": [row]}})
    assert result["status"] == "completed"
    assert result["recommendations"]
    assert result["recommendations"][0]["supplier_source"] == "uploaded_user_data"
    assert result["recommendations"][0]["supplier_name"] == "Uploaded Supplier"

    missing = ml_analysis._supplier_recommendations({"erp": {"rows": [shipment]}})
    assert missing["status"] == "skipped_insufficient_data"
    assert missing["recommendations"] == []


def test_component_failure_does_not_hide_other_model_statuses(monkeypatch):
    def fail(_datasets):
        raise RuntimeError("mock inference failure")

    monkeypatch.setattr(ml_analysis, "_run_text_risk", fail)
    results = ml_analysis.run_ml_analysis({})
    assert results["text_risk"]["status"] == "failed"
    assert results["shipment_delay"]["status"] == "skipped_insufficient_data"
    assert results["demand_forecast"]["status"] == "skipped_insufficient_data"


def test_missing_optional_runtime_is_reported_as_unavailable(monkeypatch):
    def missing_runtime():
        raise ModuleNotFoundError("optional runtime missing", name="transformers")

    monkeypatch.setattr(ml_analysis, "_get_text_components", missing_runtime)
    results = ml_analysis.run_ml_analysis({
        "csr": {"rows": [{"risk_description": "Factory incident reported"}]}
    })
    assert results["text_risk"]["status"] == "unavailable"
    assert "transformers" in results["text_risk"]["message"]
    assert results["demand_forecast"]["status"] == "skipped_insufficient_data"


def test_local_delay_artifact_and_uploaded_supplier_simulation_smoke():
    erp_row = {
        "supplier_id": "LIVE-1",
        "supplier_name": "Uploaded Supplier",
        "supplier_location": "Pune",
        "component_type": "Battery",
        "supplier_risk_rating": "Low",
        "transport_mode": "Road",
        "distance_km": 250,
        "weather_condition": "Clear",
        "seasonal_rainy_period": 0,
        "traffic_level": "Low",
        "supplier_risk_rating": "Low",
        "supplier_on_time_rate": 0.92,
        "supplier_quality_rate": 0.95,
        "supplier_capacity_utilization": 0.5,
        "order_quantity": 500,
        "inventory_at_order": 200,
        "planned_lead_time_days": 5,
        "unit_cost": 250.0,
        "location": "Pune",
        "component_types": "Battery",
        "average_lead_time_days": 4,
        "on_time_delivery_rate": 0.92,
        "quality_rate": 0.95,
        "unit_cost_index": 100,
        "available_capacity_units": 1000,
        "distance_from_warehouse_km": 250,
        "active": 1,
    }
    delay = ml_analysis._run_delay_predictions({"erp": {"rows": [erp_row]}})
    recommendations = ml_analysis._supplier_recommendations({"erp": {"rows": [erp_row]}})
    simulation = ml_analysis._run_scenario_simulation({
        "wms": {
            "rows": [{
                "current_stock": 20,
                "daily_demand": 10,
                "scenario_horizon_days": 5,
                "simulation_shipment_quantity": 30,
                "baseline_lead_time_days": 4,
                "mitigated_lead_time_days": 2,
            }]
        }
    })

    assert delay["status"] == "completed"
    assert 0 <= delay["predictions"][0]["delay_probability"] <= 1
    assert delay["provenance"]["production_ready"] is False
    assert recommendations["status"] == "completed"
    assert recommendations["recommendations"][0]["supplier_id"] == "LIVE-1"
    assert recommendations["recommendations"][0]["supplier_source"] == "uploaded_user_data"
    assert simulation["status"] == "completed"
    assert simulation["assumptions"]["mitigation_is_a_user_supplied_assumption"] is True
