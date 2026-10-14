"""Offline dashboard regressions: run with pytest --noconftest for local SQLite.

These tests never connect to the configured application database or API providers.
"""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

from app.models.postgres.models import (
    DataImport, ImportedRecord, IntegrationHealthCheck, Inventory, Order, Product,
    Supplier, Warehouse,
)
from app.schemas.dashboard import DashboardOverviewResponse
from app.services.dashboard.analytics_service import DashboardAnalyticsService, _calculate_health


@compiles(JSONB, "sqlite")
def _sqlite_jsonb(_type, _compiler, **_kwargs):
    return "JSON"


@pytest.fixture
def local_db():
    engine = create_engine("sqlite:///:memory:")
    for model in (Product, Supplier, Warehouse, Order, Inventory, DataImport, ImportedRecord, IntegrationHealthCheck):
        model.__table__.create(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _component(overview, key):
    return next(component for component in overview["healthComponents"] if component["key"] == key)


def _supplier(score):
    return Supplier(
        name="Test supplier", tier="Tier 1", category="Parts", country="India",
        reliability_score=score, spend_annual_usd=100, health_status="healthy",
    )


def _check(name, status, minutes=0, **kwargs):
    return IntegrationHealthCheck(
        integration_name=name, category="api", status=status,
        checked_at=datetime.now(timezone.utc) - timedelta(minutes=minutes), **kwargs,
    )


def test_empty_database_reports_insufficient_data(local_db):
    result = DashboardAnalyticsService.get_overview(local_db)
    assert result["overallHealthScore"] is None
    assert result["healthDataStatus"] == "insufficient_data"
    assert all(item["score"] is None and item["sampleSize"] == 0 for item in result["healthComponents"])
    assert result["activeIntegrationsHealthy"] == 0
    assert DashboardOverviewResponse(**result).overallHealthScore is None


def test_available_component_weights_are_normalized(local_db):
    local_db.add_all([_supplier(60), _supplier(80)])
    local_db.commit()
    result = DashboardAnalyticsService.get_overview(local_db)
    assert result["overallHealthScore"] == 70
    assert _component(result, "supplier_reliability")["sampleSize"] == 2
    assert _component(result, "inventory_coverage")["score"] is None
    assert result["healthDataStatus"] == "available"


def test_score_updates_after_real_data_and_latest_api_results_change(local_db):
    product = Product(sku="HEALTH-1", name="Test part", category="Parts", price=10)
    warehouse = Warehouse(name="Test warehouse", location="Delhi", country="India", capacity_units=100)
    local_db.add_all([product, warehouse, _supplier(80)])
    local_db.flush()
    inventory = Inventory(
        product_id=product.id, warehouse_id=warehouse.id,
        stock_quantity=10, reorder_level=20, safety_stock_level=5,
    )
    delayed_order = Order(order_status="delayed", order_date=datetime.now(timezone.utc))
    local_db.add_all([
        inventory, delayed_order,
        Order(order_status="completed", order_date=datetime.now(timezone.utc)),
        Order(order_status="processing", order_date=datetime.now(timezone.utc)),
        _check("Weather API", "unhealthy", minutes=1),
    ])
    local_db.commit()

    before = DashboardAnalyticsService.get_overview(local_db)
    # 80*.35 + 50*.30 + 50*.25 + 0*.10 = 55.5.
    assert before["overallHealthScore"] == 55.5
    assert _component(before, "order_outcomes")["sampleSize"] == 2
    assert before["activeIntegrationsHealthy"] == 0

    inventory.stock_quantity = 30
    delayed_order.order_status = "DELIVERED"
    local_db.add(_check("Weather API", "healthy"))
    local_db.commit()

    after = DashboardAnalyticsService.get_overview(local_db)
    assert after["overallHealthScore"] == 93
    assert after["activeIntegrationsHealthy"] == 1
    assert _component(after, "integration_health")["sampleSize"] == 1
    assert DashboardOverviewResponse(**after).overallHealthScore == 93


def test_each_integration_only_contributes_its_latest_observation(local_db):
    local_db.add_all([
        *[_check("Weather API", "healthy", minutes=1) for _ in range(12)],
        _check(" weather api ", "unhealthy"),
        _check("News API", "healthy"),
    ])
    local_db.commit()
    result = DashboardAnalyticsService.get_overview(local_db)
    assert result["overallHealthScore"] == 50
    assert result["activeIntegrationsHealthy"] == 1
    assert _component(result, "integration_health")["sampleSize"] == 2


def test_stale_unknown_and_unconfigured_checks_are_not_assumed_healthy(local_db, monkeypatch):
    monkeypatch.setattr("app.services.dashboard.analytics_service.settings.HEALTH_CHECK_INTERVAL_SECONDS", 900)
    local_db.add_all([
        _check("Stale API", "healthy", minutes=20),
        _check("Disabled API", "healthy", details={"is_enabled": False}),
        _check("Unconfigured API", "healthy", details={"configuration_status": "not_configured"}),
        _check("Legacy missing config", "degraded", error_category="config_missing"),
        _check("Unknown API", "unknown"),
    ])
    local_db.commit()
    result = DashboardAnalyticsService.get_overview(local_db)
    assert result["overallHealthScore"] is None
    assert result["activeIntegrationsHealthy"] == 0
    assert "5 stale, unknown, disabled or unconfigured" in result["healthExplanation"]


def test_missing_thresholds_and_pending_orders_do_not_invent_success():
    inventory = SimpleNamespace(stock_quantity=100, reorder_level=0, safety_stock_level=0)
    orders = [SimpleNamespace(order_status=status) for status in ("Processing", "in transit", "", "unrecognized")]
    result = _calculate_health([], [inventory], orders, [], datetime.now(timezone.utc))
    assert result["overallHealthScore"] is None


def test_zero_health_remains_a_real_score(local_db):
    local_db.add_all([_supplier(0), _check("Weather API", "unhealthy")])
    local_db.commit()
    result = DashboardAnalyticsService.get_overview(local_db)
    assert result["overallHealthScore"] == 0
    assert result["healthDataStatus"] == "available"


def test_inventory_coverage_uses_safety_threshold_and_caps_excess_stock():
    inventory = [
        SimpleNamespace(stock_quantity=5, reorder_level=5, safety_stock_level=10),
        SimpleNamespace(stock_quantity=1000, reorder_level=10, safety_stock_level=5),
        SimpleNamespace(stock_quantity=-5, reorder_level=10, safety_stock_level=5),
    ]
    result = _calculate_health([], inventory, [], [], datetime.now(timezone.utc))
    assert result["overallHealthScore"] == 50


def test_invalid_supplier_scores_are_excluded_and_score_is_bounded():
    suppliers = [SimpleNamespace(reliability_score=value) for value in (None, "invalid", float("nan"), float("inf"), -10, 140)]
    result = _calculate_health(suppliers, [], [], [], datetime.now(timezone.utc))
    assert result["overallHealthScore"] == 50
    assert _component(result, "supplier_reliability")["sampleSize"] == 2
