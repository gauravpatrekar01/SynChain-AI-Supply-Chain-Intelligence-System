import io
import uuid

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_current_active_user
from app.models.postgres.models import User
from app.services.intelligence.intelligence_service import MAX_UPLOAD_BYTES, USER_DATASTORE


# --------------------------------------------------
# Test setup
# --------------------------------------------------

client = TestClient(app)

# Mock authenticated user
mock_user = User(
    id=uuid.uuid4(),
    name="Test User",
    email="test@example.com",
    password_hash="test-password-hash",
    is_active=True,
)

# Override authentication for testing
app.dependency_overrides[get_current_active_user] = lambda: mock_user


@pytest.fixture(autouse=True)
def clear_user_datasets():
    USER_DATASTORE.clear()
    yield
    USER_DATASTORE.clear()


# --------------------------------------------------
# Helper function
# --------------------------------------------------

def create_csv(data):
    """Convert dictionary data into CSV bytes."""
    df = pd.DataFrame(data)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    return csv_buffer.getvalue().encode("utf-8")


# --------------------------------------------------
# ERP upload tests
# --------------------------------------------------

def test_upload_erp_valid():
    data = {
        "supplier_id": ["S1"],
        "supplier_name": ["Supplier A"],
        "product_id": ["P1"],
        "order_id": ["O1"],
        "lead_time_days": [25],
        "unit_cost": [10.0],
        "order_quantity": [100],
    }

    response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={
            "file": (
                "erp.csv",
                io.BytesIO(create_csv(data)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True


# --------------------------------------------------
# WMS upload tests
# --------------------------------------------------

def test_upload_wms_valid():
    data = {
        "warehouse_id": ["W1"],
        "product_id": ["P1"],
        "current_stock": [50],
        "reorder_level": [60],
        "daily_demand": [10],
    }

    response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={
            "file": (
                "wms.csv",
                io.BytesIO(create_csv(data)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True


# --------------------------------------------------
# CSR upload tests
# --------------------------------------------------

def test_upload_csr_valid():
    data = {
        "supplier_id": ["S1"],
        "supplier_name": ["Supplier A"],
        "emissions_score": [40],
        "compliance_score": [60],
    }

    response = client.post(
        "/api/v1/intelligence/upload/csr",
        files={
            "file": (
                "csr.csv",
                io.BytesIO(create_csv(data)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    analysis = client.post("/api/v1/intelligence/analyze")
    assert analysis.status_code == 200
    result = analysis.json()
    assert {risk["severity"] for risk in result["risks"]} == {"medium"}
    assert any("No documented CSR threshold configuration" in item for item in result["limitations"])


# --------------------------------------------------
# Validation tests
# --------------------------------------------------

def test_upload_invalid_extension():
    response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={
            "file": (
                "test.txt",
                io.BytesIO(b"not a csv"),
                "text/plain",
            )
        },
    )

    assert response.status_code == 400
    assert "Only .csv files are supported" in response.json()["detail"]


def test_upload_missing_columns():
    data = {
        "random_col": ["value"],
    }

    response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={
            "file": (
                "erp.csv",
                io.BytesIO(create_csv(data)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 400
    assert "missing required columns" in response.json()["detail"]


def test_upload_empty_csv():
    for content, expected in (
        (b"", "The uploaded CSV file is empty."),
        (
            b"supplier_id,supplier_name,product_id,order_id,lead_time_days\n",
            "The uploaded CSV contains no actionable rows.",
        ),
    ):
        response = client.post(
            "/api/v1/intelligence/upload/erp",
            files={"file": ("erp.csv", io.BytesIO(content), "text/csv")},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == expected


def test_upload_size_limit():
    response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={
            "file": (
                "large.csv",
                io.BytesIO(b"x" * (MAX_UPLOAD_BYTES + 1)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 413
    assert "exceeds the 2MB limit" in response.json()["detail"]


@pytest.mark.parametrize(
    ("content", "expected_detail"),
    [
        (
            b"warehouse_id,product_id,current_stock,daily_demand\nW1,P1,10\n",
            "Malformed CSV row 1",
        ),
        (
            b'warehouse_id,product_id,current_stock,daily_demand\nW1,"P1,10,2\n',
            "Malformed CSV content",
        ),
    ],
)
def test_upload_malformed_csv(content, expected_detail):
    response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={"file": ("wms.csv", io.BytesIO(content), "text/csv")},
    )

    assert response.status_code == 400
    assert expected_detail in response.json()["detail"]


@pytest.mark.parametrize(
    ("stock", "expected_detail"),
    [
        ("not-a-number", "must be a finite, non-negative number"),
        ("-1", "must be a finite, non-negative number"),
        ("NaN", "must be a finite, non-negative number"),
        ("", "missing a required value"),
    ],
)
def test_upload_invalid_or_missing_wms_values(stock, expected_detail):
    content = (
        "warehouse_id,product_id,current_stock,daily_demand\n"
        f"W1,P1,{stock},10\n"
    ).encode("utf-8")
    response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={"file": ("wms.csv", io.BytesIO(content), "text/csv")},
    )

    assert response.status_code == 400
    assert expected_detail in response.json()["detail"]


def test_upload_accepts_explicit_wms_history_and_rejects_invalid_date():
    valid_csv = (
        "warehouse_id,product_id,current_stock,daily_demand,observation_date\n"
        "W1,P1,50,10,2025-01-01\n"
    ).encode("utf-8")
    valid_response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={"file": ("wms-history.csv", io.BytesIO(valid_csv), "text/csv")},
    )
    assert valid_response.status_code == 200
    assert USER_DATASTORE[str(mock_user.id)]["wms"]["rows"][0]["observation_date"] == "2025-01-01"

    invalid_csv = valid_csv.replace(b"2025-01-01", b"2025-99-99")
    invalid_response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={"file": ("wms-invalid-date.csv", io.BytesIO(invalid_csv), "text/csv")},
    )
    assert invalid_response.status_code == 400
    assert "invalid observation_date" in invalid_response.json()["detail"]


def test_upload_rejects_out_of_range_model_feature():
    data = {
        "supplier_id": ["S1"],
        "supplier_name": ["Supplier A"],
        "product_id": ["P1"],
        "order_id": ["O1"],
        "lead_time_days": [5],
        "unit_cost": [10.0],
        "order_quantity": [100],
        "supplier_on_time_rate": [1.2],
    }
    response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={"file": ("erp.csv", io.BytesIO(create_csv(data)), "text/csv")},
    )
    assert response.status_code == 400
    assert "supplier_on_time_rate" in response.json()["detail"]


# --------------------------------------------------
# Analysis workflow test
# --------------------------------------------------

def test_analyze_and_results():
    # Step 1: Upload ERP data containing a long lead time.
    erp_data = {
        "supplier_id": ["S1"],
        "supplier_name": ["Supplier A"],
        "product_id": ["P1"],
        "order_id": ["O1"],
        "lead_time_days": [35],
        "unit_cost": [10.0],
        "order_quantity": [100],
    }

    erp_response = client.post(
        "/api/v1/intelligence/upload/erp",
        files={
            "file": (
                "erp.csv",
                io.BytesIO(create_csv(erp_data)),
                "text/csv",
            )
        },
    )

    assert erp_response.status_code == 200

    # Step 2: Upload WMS data indicating low inventory.
    wms_data = {
        "warehouse_id": ["W1"],
        "product_id": ["P1"],
        "current_stock": [5],
        "reorder_level": [20],
        "daily_demand": [10],
    }

    wms_response = client.post(
        "/api/v1/intelligence/upload/wms",
        files={
            "file": (
                "wms.csv",
                io.BytesIO(create_csv(wms_data)),
                "text/csv",
            )
        },
    )

    assert wms_response.status_code == 200

    # Step 3: Run the analysis.
    analyze_response = client.post(
        "/api/v1/intelligence/analyze"
    )

    assert analyze_response.status_code == 200
    analysis = analyze_response.json()
    assert analysis["analysis_status"] == "ready"
    assert set(analysis["available_datasets"]) == {"erp", "wms"}

    # Step 4: Retrieve analysis results.
    results_response = client.get(
        "/api/v1/intelligence/results"
    )

    assert results_response.status_code == 200

    results = results_response.json()

    assert results["analysis_status"] == "ready"
    assert len(results["risks"]) > 0

    # At least one risk should be classified as high.
    assert any(
        risk["severity"] == "high"
        for risk in results["risks"]
    )
    assert any(
        risk["dataset"] == "erp"
        and risk["title"] == "Supplier lead-time risk"
        and risk["severity"] == "high"
        for risk in results["risks"]
    )
    assert any(
        risk["dataset"] == "wms"
        and risk["severity"] == "medium"
        and "0.50 days" in risk["evidence"][0]
        for risk in results["risks"]
    )
    assert results["recommendations"]
    assert results["ml_analysis"]["shipment_delay"]["status"] == "skipped_insufficient_data"
    assert "component_type" in results["ml_analysis"]["shipment_delay"]["missing_features"]
    assert isinstance(results["dataset_status"]["erp"]["rows"], int)


def test_zero_daily_demand_does_not_divide_by_zero():
    wms_data = {
        "warehouse_id": ["W1"],
        "product_id": ["P1"],
        "current_stock": [10],
        "daily_demand": [0],
    }
    upload = client.post(
        "/api/v1/intelligence/upload/wms",
        files={
            "file": (
                "zero-demand.csv",
                io.BytesIO(create_csv(wms_data)),
                "text/csv",
            )
        },
    )

    assert upload.status_code == 200
    analysis = client.post("/api/v1/intelligence/analyze")
    assert analysis.status_code == 200
    assert analysis.json()["analysis_status"] == "limited"
    assert analysis.json()["risks"] == []


def test_datasets_are_isolated_between_users():
    user_a_csv = (
        "supplier_id,supplier_name,product_id,order_id,lead_time_days,unit_cost,order_quantity\n"
        "A1,Supplier A,PA,OA,25,10,100\n"
    ).encode("utf-8")
    upload_a = client.post(
        "/api/v1/intelligence/upload/erp",
        files={"file": ("user-a.csv", io.BytesIO(user_a_csv), "text/csv")},
    )
    assert upload_a.status_code == 200

    original_override = app.dependency_overrides[get_current_active_user]
    user_b = User(
        id=uuid.uuid4(),
        name="Second Test User",
        email="second-test@example.com",
        password_hash="test-password-hash",
        is_active=True,
    )
    app.dependency_overrides[get_current_active_user] = lambda: user_b
    try:
        empty_results = client.get("/api/v1/intelligence/results")
        assert empty_results.status_code == 200
        assert empty_results.json()["analysis_status"] == "not_ready"
        assert empty_results.json()["available_datasets"] == []

        user_b_analysis = client.post("/api/v1/intelligence/analyze")
        assert user_b_analysis.status_code == 200
        assert user_b_analysis.json()["available_datasets"] == []

        user_b_csv = (
            "supplier_id,supplier_name,product_id,order_id,lead_time_days,unit_cost,order_quantity\n"
            "B1,Supplier B,PB,OB,10,12,50\n"
        ).encode("utf-8")
        upload_b = client.post(
            "/api/v1/intelligence/upload/erp",
            files={"file": ("user-b.csv", io.BytesIO(user_b_csv), "text/csv")},
        )
        assert upload_b.status_code == 200

        user_b_results = client.get("/api/v1/intelligence/results")
        assert user_b_results.status_code == 200
        assert user_b_results.json()["dataset_status"]["erp"]["filename"] == "user-b.csv"
    finally:
        app.dependency_overrides[get_current_active_user] = original_override

    user_a_results = client.get("/api/v1/intelligence/results")
    assert user_a_results.status_code == 200
    assert user_a_results.json()["dataset_status"]["erp"]["filename"] == "user-a.csv"


# --------------------------------------------------
# Cleanup
# --------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def clear_dependency_overrides():
    """Restore dependency overrides after the test session."""
    yield
    app.dependency_overrides.clear()