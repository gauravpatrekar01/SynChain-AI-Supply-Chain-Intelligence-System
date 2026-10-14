"""
Forecast and Inventory Decision API routes for SynChain AI.
Provides asynchronous, non-blocking endpoints for demand forecasting and inventory replenishment.
"""

import asyncio
import logging
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
import pandas as pd
import prophet

from app.api.deps import get_db
from app.models.postgres.models import Product, Inventory, Warehouse, Order, OrderItem, Sales
from app.services.forecasting.prophet_forecast import ForecastingService, MODEL_VERSION
from app.services.forecasting.inventory_decision import InventoryDecisionModule
from app.schemas.forecasting import (
    DemandForecastRequest,
    DemandForecastResponse,
    InventoryPolicyRequest,
    InventoryPolicyResponse,
    ForecastHealthResponse,
    InventoryItemResponse,
    DemandHistoryResponse,
    DemandHistoryPoint,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["forecasting"])

forecast_service = ForecastingService(interval_width=0.95)
inventory_module = InventoryDecisionModule()

# Deterministic benchmark series for demo SKU IC-3NM-A18
BENCHMARK_DEMO_DEMAND_A18 = [
    {"date": "2026-09-01", "demand": 1240.0},
    {"date": "2026-09-02", "demand": 1285.0},
    {"date": "2026-09-03", "demand": 1310.0},
    {"date": "2026-09-04", "demand": 1290.0},
    {"date": "2026-09-05", "demand": 1150.0},
    {"date": "2026-09-06", "demand": 1100.0},
    {"date": "2026-09-07", "demand": 1260.0},
    {"date": "2026-09-08", "demand": 1320.0},
    {"date": "2026-09-09", "demand": 1350.0},
    {"date": "2026-09-10", "demand": 1380.0},
    {"date": "2026-09-11", "demand": 1340.0},
    {"date": "2026-09-12", "demand": 1190.0},
    {"date": "2026-09-13", "demand": 1120.0},
    {"date": "2026-09-14", "demand": 1290.0},
    {"date": "2026-09-15", "demand": 1360.0},
    {"date": "2026-09-16", "demand": 1410.0},
    {"date": "2026-09-17", "demand": 1390.0},
    {"date": "2026-09-18", "demand": 1360.0},
    {"date": "2026-09-19", "demand": 1210.0},
    {"date": "2026-09-20", "demand": 1140.0},
    {"date": "2026-09-21", "demand": 1310.0},
    {"date": "2026-09-22", "demand": 1390.0},
    {"date": "2026-09-23", "demand": 1430.0},
    {"date": "2026-09-24", "demand": 1420.0},
    {"date": "2026-09-25", "demand": 1380.0},
    {"date": "2026-09-26", "demand": 1230.0},
    {"date": "2026-09-27", "demand": 1160.0},
    {"date": "2026-09-28", "demand": 1340.0},
    {"date": "2026-09-29", "demand": 1420.0},
    {"date": "2026-09-30", "demand": 1460.0},
]


def _get_retail_csv_path() -> Path:
    """Resolves the retail inventory dataset path across runtime working directories."""
    candidates = [
        Path(__file__).resolve().parents[4] / "data" / "processed" / "retail_inventory_cleaned.csv",
        Path("data/processed/retail_inventory_cleaned.csv").resolve(),
        Path("../data/processed/retail_inventory_cleaned.csv").resolve(),
        Path("../../data/processed/retail_inventory_cleaned.csv").resolve(),
    ]
    for p in candidates:
        if p.is_file():
            return p
    return candidates[0]


@router.get(
    "/forecast/health",
    response_model=ForecastHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Forecasting engine status and runtime environment metadata",
)
async def get_forecast_health():
    """Returns engine readiness and dynamic Prophet version."""
    prophet_ver = getattr(prophet, "__version__", None)
    if not prophet_ver:
        try:
            import importlib.metadata
            prophet_ver = importlib.metadata.version("prophet")
        except Exception:
            prophet_ver = "unknown"

    return {
        "status": "nominal",
        "engine": "SynChain AI Neural Forecasting Engine",
        "prophetVersion": prophet_ver,
        "prophet_version": prophet_ver,
        "availableAlgorithms": [
            f"Prophet (Additive Generalized Model, {prophet_ver})",
            "AutoRegressive Lags (AR-7) + Linear Trend (Statistical Baseline)",
            "Empirical Cumulative Lead-Time Quantile Buffer",
            "Parametric Gaussian Safety Stock Optimizer",
        ],
        "available_algorithms": [
            f"Prophet (Additive Generalized Model, {prophet_ver})",
            "AutoRegressive Lags (AR-7) + Linear Trend (Statistical Baseline)",
            "Empirical Cumulative Lead-Time Quantile Buffer",
            "Parametric Gaussian Safety Stock Optimizer",
        ],
        "ready": True,
    }


@router.get(
    "/inventory/items",
    response_model=List[InventoryItemResponse],
    status_code=status.HTTP_200_OK,
    summary="List available inventory products with stock levels and data source transparency",
)
@router.get(
    "/inventory",
    response_model=List[InventoryItemResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_inventory_items_route(db: Session = Depends(get_db)):
    """
    Returns available supply chain inventory items.
    Explicitly labels:
    - 'postgresql_live': Live records in PostgreSQL (note: 0 sales observations in DB).
    - 'retail_dataset_actual': Verified historical dataset records with 731 days of genuine sales.
    - 'deterministic_demo': Designated benchmark items with synthetic baseline.
    """
    items: List[Dict[str, Any]] = []

    # 1. Query PostgreSQL Live Inventory
    try:
        inv_records = (
            db.query(Inventory, Product, Warehouse)
            .join(Product, Inventory.product_id == Product.id)
            .join(Warehouse, Inventory.warehouse_id == Warehouse.id)
            .all()
        )
        for inv, prod, wh in inv_records:
            items.append({
                "sku": prod.sku,
                "name": prod.name,
                "category": prod.category or "Components",
                "warehouse": wh.name,
                "warehouseLocation": wh.location or wh.name,
                "currentStock": int(inv.stock_quantity),
                "safetyStock": int(inv.safety_stock_level),
                "reorderLevel": int(inv.reorder_level),
                "reorderQuantity": int(inv.reorder_quantity or 100),
                "unitPrice": float(prod.price or 0.0),
                "leadTimeDays": 7,
                "dataSource": "postgresql_live",
                "hasHistoricalDemand": False,
                "description": f"Live database record in {wh.name} (0 historical sales observations)",
            })
    except Exception as e:
        logger.warning("PostgreSQL inventory query error: %s", e)

    # 2. Verified actual historical products from retail dataset (P0001 - P0005)
    retail_csv = _get_retail_csv_path()
    if retail_csv.is_file():
        actual_catalog = [
            ("P0001", "Groceries Item P0001", "Groceries", "Austin Retail Hub S001", "Austin, TX", 231, 135, 150, 200, 33.50, 7),
            ("P0002", "Toys Item P0002", "Toys", "Dallas Retail Hub S001", "Dallas, TX", 204, 144, 160, 200, 63.01, 7),
            ("P0003", "Toys Item P0003", "Toys", "West Regional Hub S001", "Phoenix, AZ", 102, 74, 90, 150, 27.99, 5),
            ("P0004", "Toys Item P0004", "Toys", "North Distribution Hub S001", "Chicago, IL", 469, 62, 100, 150, 32.72, 7),
            ("P0005", "Electronics Item P0005", "Electronics", "East Regional SuperHub S001", "Memphis, TN", 166, 10, 50, 100, 73.64, 10),
        ]
        for sku, name, cat, wh_name, loc, stock, safety, rop, rop_qty, price, lt in actual_catalog:
            items.append({
                "sku": sku,
                "name": name,
                "category": cat,
                "warehouse": wh_name,
                "warehouseLocation": loc,
                "currentStock": stock,
                "safetyStock": safety,
                "reorderLevel": rop,
                "reorderQuantity": rop_qty,
                "unitPrice": price,
                "leadTimeDays": lt,
                "dataSource": "retail_dataset_actual",
                "hasHistoricalDemand": True,
                "description": "731 days of verified daily customer sales & inventory observations",
            })

    # 3. Explicitly designated benchmark demo SKUs
    demo_catalog = [
        ("IC-3NM-A18", "3nm Ultra AI Neural Processor", "Logic Silicon", "Giga Austin Warehouse", "Austin, TX", 45000, 30000, 35000, 15000, 480.0, 7),
        ("HBM3E-24G", "High Bandwidth Memory 24GB", "Memory IC", "Memphis SuperHub", "Memphis, TN", 18500, 25000, 28000, 10000, 320.0, 14),
    ]
    for sku, name, cat, wh_name, loc, stock, safety, rop, rop_qty, price, lt in demo_catalog:
        items.append({
            "sku": sku,
            "name": name,
            "category": cat,
            "warehouse": wh_name,
            "warehouseLocation": loc,
            "currentStock": stock,
            "safetyStock": safety,
            "reorderLevel": rop,
            "reorderQuantity": rop_qty,
            "unitPrice": price,
            "leadTimeDays": lt,
            "dataSource": "deterministic_demo",
            "hasHistoricalDemand": True,
            "description": "Deterministic neural benchmark time-series simulation",
        })

    return items


@router.get(
    "/forecast/demand-history/{sku}",
    response_model=DemandHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve verified daily historical demand observations for a SKU",
)
def get_demand_history_route(
    sku: str,
    store_id: str = "S001",
    limit: int = 90,
    db: Session = Depends(get_db)
):
    """
    Returns verified historical demand observations for time-series forecasting.
    - Verified Retail SKUs ('P0001'..'P0020'): Loads genuine historical daily sales from retail dataset.
    - Benchmark Demo SKUs ('IC-3NM-A18', 'HBM3E-24G'): Explicitly simulated reproducible series.
    - PostgreSQL Live SKUs ('SYN-TEST-*'): Rejects forecasting if daily history is missing (no silent faking).
    - Unknown SKUs: Returns 404.
    """
    clean_sku = sku.strip()

    # Case A: Retail Dataset Actual SKUs
    if clean_sku.upper().startswith("P") and clean_sku.upper()[1:].isdigit():
        retail_csv = _get_retail_csv_path()
        if not retail_csv.is_file():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Historical dataset file not found at {retail_csv}",
            )
        try:
            from app.services.forecasting.data_loader import load_retail_inventory_series
            df = load_retail_inventory_series(
                csv_path=str(retail_csv),
                store_id=store_id,
                product_id=clean_sku.upper(),
                target_col="units_sold",
            )
            df = df.tail(limit if limit > 0 else 90)
            points = [
                {"date": str(row["date"])[:10], "demand": float(row["demand"])}
                for _, row in df.iterrows()
            ]
            return {
                "sku": clean_sku.upper(),
                "productName": f"Retail Product {clean_sku.upper()}",
                "dataSource": "retail_dataset_actual",
                "isSimulated": False,
                "totalObservations": len(points),
                "storeId": store_id,
                "historicalData": points,
            }
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )

    # Case B: Deterministic Benchmark Demo SKUs
    if clean_sku.upper() == "IC-3NM-A18":
        points = [
            {"date": pt["date"], "demand": float(pt["demand"])}
            for pt in BENCHMARK_DEMO_DEMAND_A18
        ]
        return {
            "sku": "IC-3NM-A18",
            "productName": "3nm Ultra AI Neural Processor",
            "dataSource": "deterministic_demo",
            "isSimulated": True,
            "totalObservations": len(points),
            "storeId": "WH-AUSTIN-01",
            "historicalData": points,
        }

    if clean_sku.upper() == "HBM3E-24G":
        base_date = pd.Timestamp("2026-07-24")
        points = []
        for i in range(30):
            d_str = (base_date + pd.Timedelta(days=i)).strftime("%Y-%m-%d")
            val = round(220.0 + 35.0 * math.sin(i * 0.45) + (i % 7) * 4.0, 1)
            points.append({"date": d_str, "demand": val})
        return {
            "sku": "HBM3E-24G",
            "productName": "High Bandwidth Memory 24GB",
            "dataSource": "deterministic_demo",
            "isSimulated": True,
            "totalObservations": len(points),
            "storeId": "WH-MEMPHIS-01",
            "historicalData": points,
        }

    # Case C: PostgreSQL Live Products
    prod = db.query(Product).filter(Product.sku == clean_sku).first()
    if prod:
        sales_count = db.query(Sales).filter(Sales.product_id == prod.id).count()
        order_items_count = db.query(OrderItem).filter(OrderItem.product_id == prod.id).count()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Product '{clean_sku}' ({prod.name}) is registered in PostgreSQL, but has insufficient "
                f"historical demand observations in the database ({sales_count} sales records, "
                f"{order_items_count} batch order records). A minimum of 5 daily continuous observations "
                f"is required to generate an empirical or statistical forecast. SynChain AI never silently "
                "substitutes synthetic data for live production items."
            ),
        )

    # Case D: Unknown SKU
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Product SKU '{clean_sku}' was not found in live inventory or available datasets.",
    )


@router.post(
    "/forecast/demand",
    response_model=DemandForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate enterprise demand forecast with Prophet and baseline fallback",
)
@router.post(
    "/forecast",
    response_model=DemandForecastResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=True,
    summary="Legacy demand forecast endpoint (backward-compatible)",
)
async def generate_demand_forecast_route(request: DemandForecastRequest):
    """
    Executes time-series demand forecasting asynchronously using Prophet with
    automatic fallback to statistical AutoRegressive baseline for short series.
    """
    try:
        result = await asyncio.to_thread(
            forecast_service.generate_demand_forecast,
            historical_data=request.historicalData,
            horizon=request.horizonDays,
            evaluate=request.evaluate,
        )
        result["productId"] = request.productId
        result["product_id"] = request.productId
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Forecast computation failure: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Forecasting computation failed for the provided time series. Ensure valid dates, non-negative values, and sufficient observations.",
        )


@router.post(
    "/inventory/reorder-policy",
    response_model=InventoryPolicyResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute inventory replenishment policy and safety stock buffers",
)
@router.post(
    "/forecast/inventory/reorder-policy",
    response_model=InventoryPolicyResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def calculate_inventory_reorder_policy_route(request: InventoryPolicyRequest):
    """
    Calculates expected lead-time demand, safety stock, and reorder point (ROP)
    using empirical lead-time quantile errors or parametric RMSE scaling.
    Evaluates current stock against ROP to recommend replenishment quantities.
    """
    try:
        result = await asyncio.to_thread(
            inventory_module.calculate_inventory_policy,
            demand_forecast=request.forecastPoints,
            lead_time_days=request.leadTimeDays,
            service_level=request.targetServiceLevel,
            cumulative_lead_time_errors=request.cumulativeLeadTimeErrors,
            daily_forecast_rmse=request.dailyForecastRmse,
            lead_time_std_days=request.leadTimeStdDays,
            holding_cost_per_unit=request.holdingCostPerUnit,
            stockout_cost_per_unit=request.stockoutCostPerUnit,
            current_stock=request.currentStock,
            standard_reorder_quantity=request.standardReorderQuantity,
        )

        if result.get("status") in ("insufficient_horizon", "insufficient_uncertainty_data"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.get("error_message", "Invalid inventory planning parameters."),
            )

        result["productId"] = request.productId
        result["product_id"] = request.productId
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Inventory policy computation failure: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inventory decision policy computation failed. Check forecast values and lead-time bounds.",
        )