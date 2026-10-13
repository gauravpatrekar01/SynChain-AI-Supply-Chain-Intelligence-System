from pathlib import Path
import sys

import pandas as pd
import pytest

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC_DIR))

import recommend_supplier


@pytest.fixture
def sample_shipment():
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


def test_recommend_suppliers_returns_ranked_results(sample_shipment):
    results = recommend_supplier.recommend_suppliers(sample_shipment, max_results=3)

    assert isinstance(results, list)
    assert len(results) > 0
    assert all("supplier_id" in item for item in results)
    assert all("recommendation_score" in item for item in results)
    assert all("estimated_delay_probability" in item for item in results)
    assert results[0]["component_type"] == "Battery"


def test_recommend_suppliers_missing_required_fields_raises_value_error():
    with pytest.raises(ValueError, match="missing required fields"):
        recommend_supplier.recommend_suppliers({"component_type": "Battery"})


def test_recommend_suppliers_invalid_order_quantity_raises_value_error():
    with pytest.raises(ValueError, match="order_quantity"):
        recommend_supplier.recommend_suppliers({
            "component_type": "Battery",
            "order_quantity": 0,
        })


def test_recommend_suppliers_handles_unsupported_component_type(sample_shipment):
    shipment = {**sample_shipment, "component_type": "UnsupportedPart"}

    assert recommend_supplier.recommend_suppliers(shipment) == []


def test_recommend_suppliers_handles_empty_supplier_data(monkeypatch, sample_shipment):
    monkeypatch.setattr(
        recommend_supplier,
        "load_suppliers",
        lambda: pd.DataFrame(columns=[
            "supplier_id",
            "supplier_name",
            "location",
            "component_types",
            "average_lead_time_days",
            "on_time_delivery_rate",
            "quality_rate",
            "unit_cost_index",
            "available_capacity_units",
            "distance_from_warehouse_km",
            "active",
        ]),
    )

    assert recommend_supplier.recommend_suppliers(sample_shipment) == []


def test_recommend_suppliers_can_use_only_explicit_uploaded_profiles(sample_shipment):
    profile = {
        "supplier_id": "REAL-1",
        "supplier_name": "Uploaded Partner",
        "location": "Pune",
        "component_types": "Battery",
        "supplier_risk_rating": "Low",
        "average_lead_time_days": 4,
        "on_time_delivery_rate": 0.92,
        "quality_rate": 0.95,
        "unit_cost_index": 100,
        "available_capacity_units": 1000,
        "distance_from_warehouse_km": 250,
        "active": 1,
    }
    inactive = {**profile, "supplier_id": "REAL-2", "active": 0}
    over_capacity = {
        **profile,
        "supplier_id": "REAL-3",
        "available_capacity_units": 10,
    }
    results = recommend_supplier.recommend_suppliers(
        sample_shipment,
        supplier_records=[profile, inactive, over_capacity],
        predictor=lambda _: {
            "delay_probability": 0.2,
            "data_source": "synthetic_development_data",
        },
    )

    assert [item["supplier_id"] for item in results] == ["REAL-1"]
    assert results[0]["supplier_source"] == "uploaded_user_data"
    assert results[0]["ranking_factors"] == {
        "estimated_delay_probability": 0.40,
        "average_lead_time_days": 0.25,
        "quality_rate": 0.20,
        "unit_cost_index": 0.15,
    }


def test_uploaded_supplier_recommendation_requires_explicit_risk_rating(sample_shipment):
    profile = {
        "supplier_id": "REAL-1",
        "supplier_name": "Uploaded Partner",
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

    with pytest.raises(ValueError, match="explicit supplier_risk_rating"):
        recommend_supplier.recommend_suppliers(
            sample_shipment,
            supplier_records=[profile],
            predictor=lambda _: {"delay_probability": 0.2},
        )


def test_recommend_suppliers_surfaces_prediction_failure(monkeypatch, sample_shipment):
    def raise_error(_):
        raise ValueError("bad model input")

    monkeypatch.setattr(recommend_supplier, "predict_shipment", raise_error)

    with pytest.raises(RuntimeError, match="Unable to estimate delay risk"):
        recommend_supplier.recommend_suppliers(sample_shipment)


def test_load_suppliers_raises_for_missing_file(monkeypatch):
    monkeypatch.setattr(recommend_supplier, "SUPPLIER_FILE", Path("missing.csv"))

    with pytest.raises(FileNotFoundError):
        recommend_supplier.load_suppliers()
