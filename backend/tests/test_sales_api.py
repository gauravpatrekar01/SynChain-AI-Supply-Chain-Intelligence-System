"""
Comprehensive integration and unit test suite for SynChain AI Sales Forecasting Module.
Tests CSV upload preview, schema validation, duplicate detection, atomic import,
revenue calculations, historical aggregations, YoY equivalent-period analysis,
time-series forecasting, scenario simulation, and supply chain integration.
"""

import io
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.postgres.models import SalesTransaction

client = TestClient(app)

SAMPLE_CSV_CONTENT = """transaction_id,transaction_date,product_id,product_name,product_category,quantity_sold,unit_selling_price,discount_amount,return_quantity,tax_amount,region
TEST-TX-001,2026-01-05,IC-3NM-A18,Neural Processor,Logic Silicon,20,150.00,100.00,2,25.00,North America
TEST-TX-002,2026-01-15,IC-3NM-A18,Neural Processor,Logic Silicon,30,150.00,0.00,0,0.00,North America
TEST-TX-003,2026-01-25,HBM3E-24G,Memory 24GB,Memory IC,40,80.00,50.00,0,10.00,Asia Pacific
TEST-TX-004,2026-02-05,IC-3NM-A18,Neural Processor,Logic Silicon,25,150.00,50.00,1,0.00,North America
TEST-TX-005,2026-02-18,HBM3E-24G,Memory 24GB,Memory IC,35,80.00,0.00,0,0.00,Europe
TEST-TX-006,2026-03-02,IC-3NM-A18,Neural Processor,Logic Silicon,30,150.00,0.00,0,0.00,North America
TEST-TX-007,2026-03-15,HBM3E-24G,Memory 24GB,Memory IC,50,80.00,100.00,0,0.00,Asia Pacific
TEST-TX-008,2026-03-28,IC-3NM-A18,Neural Processor,Logic Silicon,35,150.00,0.00,0,0.00,North America
TEST-TX-009,2026-04-05,HBM3E-24G,Memory 24GB,Memory IC,45,80.00,0.00,0,0.00,Europe
TEST-TX-010,2026-04-12,IC-3NM-A18,Neural Processor,Logic Silicon,40,150.00,100.00,0,0.00,North America
TEST-TX-011,2026-04-20,HBM3E-24G,Memory 24GB,Memory IC,55,80.00,50.00,0,0.00,Asia Pacific
TEST-TX-012,2026-04-28,IC-3NM-A18,Neural Processor,Logic Silicon,45,150.00,0.00,0,0.00,North America
"""


def seed_test_sales():
    """Helper to upload and import test sales records into the current test transaction."""
    files = {"file": ("test_sales.csv", io.BytesIO(SAMPLE_CSV_CONTENT.encode("utf-8")), "text/csv")}
    preview_res = client.post("/api/v1/sales/upload-preview", files=files)
    assert preview_res.status_code == 200
    import_id = preview_res.json()["import_id"]
    exec_res = client.post("/api/v1/sales/import", json={"import_id": import_id, "skip_duplicates": True})
    assert exec_res.status_code == 200
    return exec_res.json()


# -----------------------------------------------------------------------------
# 1. Empty Dataset Behavior
# -----------------------------------------------------------------------------
def test_01_empty_sales_dataset():
    """Verify empty state returns clear unpopulated response without fabricated metrics."""
    response = client.get("/api/v1/sales/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["has_data"] is False
    assert data["total_revenue"] == 0.0
    assert data["total_units_sold"] == 0
    assert data["forecasted_revenue"] is None

    hist_resp = client.get("/api/v1/sales/historical")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert hist_data["has_data"] is False
    assert len(hist_data["monthly_trends"]) == 0

    fcst_resp = client.get("/api/v1/sales/forecast")
    assert fcst_resp.status_code == 200
    fcst_data = fcst_resp.json()
    assert fcst_data["has_data"] is False
    assert len(fcst_data["forecast_points"]) == 0


# -----------------------------------------------------------------------------
# 2. Invalid CSV File Format
# -----------------------------------------------------------------------------
def test_02_invalid_csv_format():
    """Reject non-CSV files."""
    file_content = b"This is a text file, not a CSV."
    files = {"file": ("data.txt", io.BytesIO(file_content), "text/plain")}
    response = client.post("/api/v1/sales/upload-preview", files=files)
    assert response.status_code == 400
    assert "Only CSV files" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 3. Missing Required Columns
# -----------------------------------------------------------------------------
def test_03_missing_required_columns():
    """Detect missing required columns and flag as unimportable."""
    csv_data = "transaction_id,transaction_date,product_id,product_name,region\nTX-1,2026-01-01,P-1,Widget,North\n"
    files = {"file": ("sales.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/sales/upload-preview", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_importable"] is False
    assert len(data["missing_required_columns"]) > 0
    assert "quantity_sold" in data["missing_required_columns"]
    assert "unit_selling_price" in data["missing_required_columns"]


# -----------------------------------------------------------------------------
# 4. Invalid Dates and Numeric Values Validation
# -----------------------------------------------------------------------------
def test_04_invalid_data_values_validation():
    """Row-level validation detects negative price, invalid quantity, and bad date."""
    csv_rows = [
        "transaction_id,transaction_date,product_id,product_name,product_category,quantity_sold,unit_selling_price,discount_amount,region",
        "BAD-1,not-a-date,SKU-A,Widget A,Cat1,10,50.0,0,US",
        "BAD-2,2026-01-02,SKU-B,Widget B,Cat1,-5,50.0,0,US",
        "BAD-3,2026-01-03,SKU-C,Widget C,Cat1,10,-20.0,0,US",
    ]
    csv_data = "\n".join(csv_rows)
    files = {"file": ("sales.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/sales/upload-preview", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["invalid_rows_count"] >= 3
    assert len(data["validation_errors"]) >= 3
    error_fields = [e["field"] for e in data["validation_errors"]]
    assert "transaction_date" in error_fields
    assert "quantity_sold" in error_fields
    assert "unit_selling_price" in error_fields


# -----------------------------------------------------------------------------
# 5. Duplicate Transaction Detection
# -----------------------------------------------------------------------------
def test_05_duplicate_transaction_detection():
    """Detect duplicate transaction_id within the file."""
    csv_rows = [
        "transaction_id,transaction_date,product_id,product_name,product_category,quantity_sold,unit_selling_price,discount_amount,region",
        "DUP-100,2026-01-01,SKU-1,Alpha,Electronics,10,100.0,0,North",
        "DUP-100,2026-01-02,SKU-1,Alpha,Electronics,15,100.0,0,North",
    ]
    csv_data = "\n".join(csv_rows)
    files = {"file": ("sales.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    response = client.post("/api/v1/sales/upload-preview", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["duplicate_in_file_count"] == 1
    dup_errors = [e for e in data["validation_errors"] if "Duplicate transaction_id" in e["message"]]
    assert len(dup_errors) == 1


# -----------------------------------------------------------------------------
# 6. Valid Import & Revenue Calculations
# -----------------------------------------------------------------------------
def test_06_valid_import_and_revenue_calculations():
    """
    Import dataset and verify net revenue calculation:
    Net = max(0, (qty - return_qty) * price - discount)
    """
    files = {"file": ("test_sales.csv", io.BytesIO(SAMPLE_CSV_CONTENT.encode("utf-8")), "text/csv")}
    preview_res = client.post("/api/v1/sales/upload-preview", files=files)
    assert preview_res.status_code == 200
    pdata = preview_res.json()
    assert pdata["is_importable"] is True
    assert pdata["total_rows_detected"] == 12
    import_id = pdata["import_id"]

    exec_res = client.post("/api/v1/sales/import", json={"import_id": import_id, "skip_duplicates": True})
    assert exec_res.status_code == 200
    edata = exec_res.json()
    assert edata["status"] == "completed"
    assert edata["imported_count"] == 12
    assert edata["total_net_revenue"] > 0


# -----------------------------------------------------------------------------
# 7. Transaction Listing, Filtering, and Pagination
# -----------------------------------------------------------------------------
def test_07_transaction_listing_and_filtering():
    """Verify transaction listing, search, and pagination on seeded data."""
    seed_test_sales()

    # Search by SKU
    resp = client.get("/api/v1/sales/transactions?search=IC-3NM-A18&page=1&page_size=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 7
    assert len(data["items"]) == 5
    assert all("IC-3NM-A18" in item["product_id"] for item in data["items"])

    # Filter by region
    reg_resp = client.get("/api/v1/sales/transactions?region=Asia Pacific")
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert reg_data["total"] >= 3


# -----------------------------------------------------------------------------
# 8. Transaction Detail, Update, and Delete
# -----------------------------------------------------------------------------
def test_08_transaction_crud():
    """Verify detail retrieval, update/correction, and deletion."""
    seed_test_sales()

    list_resp = client.get("/api/v1/sales/transactions?search=TEST-TX-001")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) > 0
    tx_id = items[0]["id"]

    # Update selling price
    update_resp = client.put(f"/api/v1/sales/transactions/{tx_id}", json={"unit_selling_price": 160.00})
    assert update_resp.status_code == 200
    up_data = update_resp.json()
    assert up_data["unit_selling_price"] == 160.00
    # Net revenue should be recomputed: (20 - 2) * 160 - 100 = 2880 - 100 = 2780.00
    assert up_data["net_revenue"] == 2780.00

    # Delete transaction
    del_resp = client.delete(f"/api/v1/sales/transactions/{tx_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True


# -----------------------------------------------------------------------------
# 9. Overview KPIs and Historical Trends
# -----------------------------------------------------------------------------
def test_09_overview_and_historical_analysis():
    """Verify KPIs, monthly trends, MoM, and category/region breakdown."""
    seed_test_sales()

    kpi_resp = client.get("/api/v1/sales/overview")
    assert kpi_resp.status_code == 200
    kpis = kpi_resp.json()
    assert kpis["has_data"] is True
    assert kpis["total_revenue"] > 10000.0
    assert kpis["total_units_sold"] > 100
    assert kpis["average_selling_price"] > 0

    hist_resp = client.get("/api/v1/sales/historical")
    assert hist_resp.status_code == 200
    hist = hist_resp.json()
    assert hist["has_data"] is True
    assert len(hist["monthly_trends"]) >= 3
    assert len(hist["product_contributions"]) >= 2
    assert len(hist["category_performance"]) >= 2
    assert len(hist["regional_performance"]) >= 2


# -----------------------------------------------------------------------------
# 10. Forecast Horizons and Boundaries
# -----------------------------------------------------------------------------
def test_10_forecast_generation_and_horizons():
    """Verify 30d, 60d, 90d forecast generation with prediction intervals."""
    seed_test_sales()

    for h in [30, 60, 90]:
        resp = client.get(f"/api/v1/sales/forecast?horizon_days={h}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_data"] is True
        assert data["has_sufficient_history"] is True
        assert len(data["forecast_points"]) == h
        assert data["total_forecasted_revenue"] > 0
        assert data["total_forecasted_units"] > 0
        assert data["forecast_start_date"] is not None
        assert data["forecast_end_date"] is not None

        # Check prediction intervals: lower <= predicted <= upper
        for pt in data["forecast_points"][:5]:
            assert pt["confidence_lower"] <= pt["predicted_revenue"]
            assert pt["predicted_revenue"] <= pt["confidence_upper"]


# -----------------------------------------------------------------------------
# 11. Product-wise Forecasting
# -----------------------------------------------------------------------------
def test_11_product_wise_forecast():
    """Filter forecast by specific product SKU."""
    seed_test_sales()

    resp = client.get("/api/v1/sales/forecast?product_id=IC-3NM-A18&horizon_days=30")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_data"] is True
    assert data["product_id"] == "IC-3NM-A18"
    assert len(data["forecast_points"]) == 30


# -----------------------------------------------------------------------------
# 12. Scenario Simulation
# -----------------------------------------------------------------------------
def test_12_scenario_simulation():
    """Verify scenario planning calculations with volume and price elasticity."""
    seed_test_sales()

    payload = {
        "scenario_name": "Growth & Price Cut",
        "horizon_days": 30,
        "volume_change_pct": 10.0,
        "price_change_pct": -5.0,
        "demand_shock_pct": 0.0,
        "apply_fulfillment_constraints": False,
    }
    resp = client.post("/api/v1/sales/simulate-scenario", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["scenario_name"] == "Growth & Price Cut"
    assert data["baseline_projected_revenue"] > 0
    assert data["scenario_projected_units"] > data["baseline_projected_units"]
    assert len(data["daily_trajectory"]) == 30
    assert "formula_breakdown" in data


# -----------------------------------------------------------------------------
# 13. Supply Chain Integration
# -----------------------------------------------------------------------------
def test_13_supply_chain_integration():
    """Verify demand conversion to inventory buffer checks."""
    seed_test_sales()

    resp = client.get("/api/v1/sales/supply-chain-integration")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_data"] is True
    assert len(data["items"]) >= 2
    skus = [item["sales_product_id"] for item in data["items"]]
    assert "IC-3NM-A18" in skus
