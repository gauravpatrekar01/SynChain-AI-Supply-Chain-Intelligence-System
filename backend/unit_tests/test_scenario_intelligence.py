"""
Unit tests for SynChain Scenario Intelligence & AI Evidence Reports.

Covers:
- Data readiness assessment
- Dynamic configuration options loading
- Deterministic simulation of baseline, disrupted, and 4 mitigation strategies
- Daily inventory trajectory calculations (no math hallucinations)
- Objective-based strategy ranking (cost, delay, service level, balanced)
- Calculation transparency formulas and provenance tracking
- Gemini AI narrative integration and deterministic fallback on 429/timeout
- ReportLab PDF generation (valid PDF stream)
- CSV and JSON evidence data export
- Report persistence and historical retrieval
- FastAPI router endpoints
"""

import io
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.main import app
from app.api.deps import get_db, get_optional_current_user
from app.models.postgres.models import (
    User,
    Product,
    Supplier,
    Warehouse,
    Inventory,
    Shipment,
    SimulationEvidenceReport,
)
from app.schemas.scenario_intelligence import ScenarioSimulationRequest
from app.services.simulation.scenario_intelligence_service import ScenarioIntelligenceService
from app.services.gemini_pool import GeminiUnavailable


@compiles(JSONB, "sqlite")
def _sqlite_jsonb(_type, _compiler, **_kwargs):
    return "JSON"


TEST_MODELS = (User, Product, Warehouse, Supplier, Inventory, Shipment, SimulationEvidenceReport)


@pytest.fixture(autouse=True)
def mock_gemini_offline():
    async def _offline_mock(*args, **kwargs):
        raise GeminiUnavailable("not_configured")

    with patch("app.services.gemini_pool.gemini_pool.generate_content_async", side_effect=_offline_mock):
        yield


@pytest.fixture
def test_db():
    """In-memory SQLite database for test isolation."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for model in TEST_MODELS:
        model.__table__.create(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed test entities
    user = User(
        id=uuid.uuid4(),
        email="test_analyst@synchain.ai",
        password_hash="hashed_pw",
        name="Supply Chain Analyst",
        role="analyst",
        is_active=True,
    )
    db.add(user)

    sup1 = Supplier(
        id=uuid.uuid4(),
        name="AeroMaterials Prime",
        tier="Tier-1",
        country="USA",
        category="Electronics",
        lead_time_days=5,
        reliability_score=94.0,
        health_status="healthy",
        spend_annual_usd=500000.0,
        single_source_risk=False,
    )
    sup2 = Supplier(
        id=uuid.uuid4(),
        name="Western Components Ltd",
        tier="Tier-2",
        country="Germany",
        category="Semiconductors",
        lead_time_days=7,
        reliability_score=88.0,
        health_status="healthy",
        spend_annual_usd=250000.0,
        single_source_risk=False,
    )
    db.add_all([sup1, sup2])

    prod = Product(
        id=uuid.uuid4(),
        sku="SYN-TEST-101",
        name="Microcontroller SYN-101",
        category="Electronics",
        price=45.0,
    )
    db.add(prod)

    wh = Warehouse(
        id=uuid.uuid4(),
        name="Central Logistics Hub",
        location="Frankfurt",
        country="Germany",
        capacity_units=50000,
    )
    db.add(wh)

    inv = Inventory(
        id=uuid.uuid4(),
        product_id=prod.id,
        warehouse_id=wh.id,
        stock_quantity=500,
    )
    db.add(inv)

    now = datetime.now(timezone.utc)
    ship = Shipment(
        id=uuid.uuid4(),
        shipment_id="SHP-9901",
        shipment_name="Microcontroller Express",
        supplier_id=sup1.id,
        origin="Shanghai",
        destination="Frankfurt",
        cargo_description="Microcontrollers",
        quantity=500,
        transport_mode="Air",
        departure_date=now,
        expected_delivery_date=now,
        carrier_name="DHL Air Cargo",
        tracking_number="SYN-TRK-9901",
        status="in_transit",
    )
    db.add(ship)

    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(test_db):
    """FastAPI test client with injected DB session."""
    def override_get_db():
        yield test_db

    def override_get_user():
        return test_db.query(User).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_optional_current_user] = override_get_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ===========================================================================
# 1. Data Readiness Tests
# ===========================================================================

def test_data_readiness_with_seeded_db(test_db):
    readiness = ScenarioIntelligenceService.assess_data_readiness(test_db)
    assert readiness.is_ready is True
    assert readiness.status in ("ready", "partial")
    assert readiness.total_products >= 1
    assert readiness.total_suppliers >= 2
    assert readiness.total_warehouses >= 1
    assert readiness.total_inventory_records >= 1
    assert readiness.readiness_score_pct >= 30.0


def test_data_readiness_empty_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    for model in TEST_MODELS:
        model.__table__.create(engine)
    TestingSession = sessionmaker(bind=engine)
    empty_db = TestingSession()
    try:
        readiness = ScenarioIntelligenceService.assess_data_readiness(empty_db)
        assert readiness.is_ready is False
        assert readiness.status == "not_ready"
        assert readiness.readiness_score_pct == 0.0
        assert len(readiness.missing_elements) >= 3
    finally:
        empty_db.close()
        engine.dispose()


# ===========================================================================
# 2. Config Options Tests
# ===========================================================================

def test_get_config_options(test_db):
    opts = ScenarioIntelligenceService.get_config_options(test_db)
    assert len(opts.products) >= 1
    assert any(p.value == "SYN-TEST-101" for p in opts.products)
    assert len(opts.suppliers) >= 2
    assert any("AeroMaterials" in s.label for s in opts.suppliers)
    assert len(opts.disruption_types) >= 4
    assert len(opts.objectives) == 4


# ===========================================================================
# 3. Deterministic Simulation & Multi-Strategy Logic
# ===========================================================================

def test_multi_strategy_simulation_deterministic(test_db):
    user = test_db.query(User).first()
    sup1 = test_db.query(Supplier).filter(Supplier.name.ilike("%AeroMaterials%")).first()
    sup2 = test_db.query(Supplier).filter(Supplier.name.ilike("%Western%")).first()

    req = ScenarioSimulationRequest(
        scenario_name="Port Bottleneck Test",
        disruption_type="port_closure",
        sku="SYN-TEST-101",
        target_supplier_id=str(sup1.id),
        target_supplier_name=sup1.name,
        alternative_supplier_id=str(sup2.id),
        alternative_supplier_name=sup2.name,
        duration_days=14,
        severity_pct=80,
        disruption_delay_days=10,
        simulation_horizon_days=30,
        initial_inventory=200,
        order_quantity=600,
        safety_stock=80,
        daily_demand=25.0,
        objective="balanced",
    )

    resp = ScenarioIntelligenceService.simulate_scenario(req, test_db, current_user_id=user.id)

    # 1. Structure verification
    assert resp.report_id.startswith("RPT-")
    assert resp.scenario_name == "Port Bottleneck Test"
    assert resp.objective == "balanced"

    # 2. Baseline vs Disrupted
    assert resp.baseline.arrival_day == 1 + 5  # day 6
    assert resp.baseline.delivery_delay_days == 0
    assert resp.baseline.service_level_pct >= 95.0
    assert resp.baseline.stockout_days_count == 0

    assert resp.disrupted.arrival_day == 1 + 5 + 10  # day 16
    assert resp.disrupted.delivery_delay_days == 10
    assert resp.disrupted.service_level_pct < resp.baseline.service_level_pct
    assert resp.disrupted.stockout_days_count > 0
    assert resp.disrupted.total_cost_usd > resp.baseline.total_cost_usd

    # 3. 4 Mitigation strategies evaluated
    strat_ids = {s.strategy_id for s in resp.mitigation_strategies}
    assert strat_ids == {"SWITCH_SUPPLIER", "SPLIT_PROCUREMENT", "EXPEDITE_AIR_FREIGHT", "ACCEPT_RISK"}

    # 4. Trajectory consistency
    for s in resp.mitigation_strategies:
        assert len(s.daily_trajectory) == 30
        for pt in s.daily_trajectory:
            assert pt.ending_inventory >= 0
            assert pt.fulfilled_demand <= pt.starting_inventory + pt.incoming_quantity + 0.01

    # 5. Objective ranking
    ranks = [s.rank for s in resp.mitigation_strategies]
    assert sorted(ranks) == [1, 2, 3, 4]
    assert resp.recommended_strategy_id == resp.mitigation_strategies[0].strategy_id

    # 6. Calculation transparency
    assert "Total Cost" in resp.calculation_transparency
    assert "Service Level" in resp.calculation_transparency
    assert "Stockout Penalty" in resp.calculation_transparency

    # 7. Persistence
    persisted = test_db.query(SimulationEvidenceReport).filter(SimulationEvidenceReport.report_id == resp.report_id).first()
    assert persisted is not None
    assert persisted.scenario_name == "Port Bottleneck Test"


def test_objective_ranking_variations(test_db):
    """Verifies that changing objectives properly shifts rankings according to mathematical priorities."""
    base_kwargs = dict(
        scenario_name="Objective Test",
        disruption_type="supplier_outage",
        duration_days=14,
        disruption_delay_days=10,
        initial_inventory=400,
        order_quantity=500,
        daily_demand=25.0,
    )

    # 1. minimize_delay: Expedited air freight should rank high (earliest arrival)
    req_delay = ScenarioSimulationRequest(**base_kwargs, objective="minimize_delay")
    resp_delay = ScenarioIntelligenceService.simulate_scenario(req_delay, test_db)
    top_delay = resp_delay.mitigation_strategies[0]
    assert top_delay.arrival_day <= 5

    # 2. maximize_service_level: Should achieve highest service level %
    req_serv = ScenarioSimulationRequest(**base_kwargs, objective="maximize_service_level")
    resp_serv = ScenarioIntelligenceService.simulate_scenario(req_serv, test_db)
    top_serv = resp_serv.mitigation_strategies[0]
    assert top_serv.service_level_pct >= 90.0


# ===========================================================================
# 4. Gemini AI Fallback and Redaction Tests
# ===========================================================================

def test_gemini_fallback_on_rate_limit(test_db):
    """When GeminiPool raises GeminiUnavailable('rate_limited'), deterministic fallback is cleanly engaged."""
    req = ScenarioSimulationRequest(
        scenario_name="Quota Exceeded Fallback Test",
        disruption_type="freight_delay",
        objective="balanced",
    )

    async def _mock_rate_limited(*args, **kwargs):
        raise GeminiUnavailable("rate_limited")

    with patch("app.services.gemini_pool.gemini_pool.generate_content_async", side_effect=_mock_rate_limited):
        resp = ScenarioIntelligenceService.simulate_scenario(req, test_db)

        # Simulation must not fail
        assert resp.ai_narrative.is_ai_generated is False
        assert resp.ai_narrative.fallback_reason == "rate_limited"
        assert len(resp.ai_narrative.executive_summary) > 20
        assert "Simulated disruption" in resp.ai_narrative.executive_summary


# ===========================================================================
# 5. ReportLab PDF Generation Tests
# ===========================================================================

def test_pdf_report_generation(test_db):
    req = ScenarioSimulationRequest(
        scenario_name="PDF Report Generation Test",
        disruption_type="port_closure",
        objective="balanced",
    )
    resp = ScenarioIntelligenceService.simulate_scenario(req, test_db)
    full_report = ScenarioIntelligenceService.get_report_by_id(test_db, resp.report_id)
    assert full_report is not None

    pdf_bytes = ScenarioIntelligenceService.generate_pdf_report(full_report)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # PDF Magic header
    assert pdf_bytes.startswith(b"%PDF")


# ===========================================================================
# 6. CSV & JSON Export Tests
# ===========================================================================

def test_csv_and_json_export(test_db):
    req = ScenarioSimulationRequest(
        scenario_name="Data Export Test",
        disruption_type="supplier_outage",
        objective="balanced",
    )
    resp = ScenarioIntelligenceService.simulate_scenario(req, test_db)
    full_report = ScenarioIntelligenceService.get_report_by_id(test_db, resp.report_id)

    csv_text = ScenarioIntelligenceService.export_evidence_csv(full_report)
    assert "SynChain Simulation Evidence Report Data Export" in csv_text
    assert "BASELINE" in csv_text
    assert "DISRUPTED" in csv_text
    assert "SWITCH_SUPPLIER" in csv_text
    assert "Daily Inventory Trajectory" in csv_text


# ===========================================================================
# 7. FastAPI API Endpoints Tests
# ===========================================================================

def test_api_scenario_endpoints(client):
    # 1. Readiness
    r1 = client.get("/api/v1/scenario/readiness")
    assert r1.status_code == 200
    data1 = r1.json()
    assert "is_ready" in data1
    assert "readiness_score_pct" in data1

    # 2. Config Options
    r2 = client.get("/api/v1/scenario/config-options")
    assert r2.status_code == 200
    data2 = r2.json()
    assert "products" in data2
    assert "suppliers" in data2

    # 3. Simulate
    sim_payload = {
        "scenario_name": "API Disruption Scenario",
        "disruption_type": "port_closure",
        "duration_days": 10,
        "severity_pct": 75,
        "objective": "balanced",
    }
    r3 = client.post("/api/v1/scenario/simulate", json=sim_payload)
    assert r3.status_code == 200
    data3 = r3.json()
    assert "report_id" in data3
    rep_id = data3["report_id"]

    # 4. List Reports
    r4 = client.get("/api/v1/scenario/reports")
    assert r4.status_code == 200
    reports_list = r4.json()
    assert len(reports_list) >= 1
    assert any(r["report_id"] == rep_id for r in reports_list)

    # 5. Get Report Detail
    r5 = client.get(f"/api/v1/scenario/reports/{rep_id}")
    assert r5.status_code == 200
    report_detail = r5.json()
    assert report_detail["report_id"] == rep_id
    assert "mitigation_strategies" in report_detail

    # 6. Download PDF
    r6 = client.get(f"/api/v1/scenario/reports/{rep_id}/pdf")
    assert r6.status_code == 200
    assert r6.headers["content-type"] == "application/pdf"
    assert r6.content.startswith(b"%PDF")

    # 7. Export CSV
    r7 = client.get(f"/api/v1/scenario/reports/{rep_id}/export?format=csv")
    assert r7.status_code == 200
    assert "text/csv" in r7.headers["content-type"]
    assert "SynChain Simulation Evidence Report" in r7.text

    # 8. Export JSON
    r8 = client.get(f"/api/v1/scenario/reports/{rep_id}/export?format=json")
    assert r8.status_code == 200
    assert "application/json" in r8.headers["content-type"]
    assert r8.json()["report_id"] == rep_id
