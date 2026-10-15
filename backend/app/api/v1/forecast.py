"""
Forecast and Inventory Decision API routes for SynChain AI.

Provides demand forecasting, historical-demand retrieval, and inventory
replenishment decisions.
"""

import asyncio
import importlib.metadata
import logging
import math
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import prophet
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.postgres.models import (
    Inventory,
    OrderItem,
    Product,
    Sales,
    Warehouse,
)
from app.models.postgres.observations import DemandObservation
from app.services.forecasting.prophet_forecast import (
    ForecastingService,
    MODEL_VERSION,
)
from app.services.forecasting.inventory_decision import (
    InventoryDecisionModule,
)
from app.schemas.forecasting import (
    DemandForecastRequest,
    DemandForecastResponse,
    InventoryPolicyRequest,
    InventoryPolicyResponse,
    ForecastHealthResponse,
    InventoryItemResponse,
    DemandHistoryResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["forecasting"])

forecast_service = ForecastingService()
inventory_module = InventoryDecisionModule()


# Deterministic benchmark data; this is simulated, not real customer sales.
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
    """Resolve the retail dataset independently of the current working directory."""
    candidates = [
        Path(__file__).resolve().parents[4]
        / "data"
        / "processed"
        / "retail_inventory_cleaned.csv",
        Path("data/processed/retail_inventory_cleaned.csv").resolve(),
        Path("../data/processed/retail_inventory_cleaned.csv").resolve(),
        Path("../../data/processed/retail_inventory_cleaned.csv").resolve(),
    ]

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    return candidates[0]


def _get_prophet_version() -> str:
    """Return the installed Prophet version when available."""
    version = getattr(prophet, "__version__", None)

    if version:
        return str(version)

    try:
        return importlib.metadata.version("prophet")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"


@router.get(
    "/forecast/health",
    response_model=ForecastHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Forecasting engine status and runtime metadata",
)
async def get_forecast_health():
    """
    Return forecasting runtime metadata.

    The available algorithm list describes the configured forecasting stack;
    it does not claim every listed algorithm is used by every request.
    """
    prophet_version = _get_prophet_version()

    return {
        "status": "nominal",
        "engine": "SynChain AI Forecasting Engine",
        "prophetVersion": prophet_version,
        "prophet_version": prophet_version,
        "availableAlgorithms": [
            f"Prophet ({prophet_version})",
            "Inventory reorder-point calculation",
            "Safety-stock calculation",
        ],
        "available_algorithms": [
            f"Prophet ({prophet_version})",
            "Inventory reorder-point calculation",
            "Safety-stock calculation",
        ],
        "ready": prophet_version != "unknown",
    }


@router.get(
    "/inventory/items",
    response_model=List[InventoryItemResponse],
    status_code=status.HTTP_200_OK,
    summary="List inventory items",
)
@router.get(
    "/inventory",
    response_model=List[InventoryItemResponse],
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def get_inventory_items_route(db: Session = Depends(get_db)):
    """Return database inventory and explicitly identified dataset/demo items."""
    items: List[Dict[str, Any]] = []

    # 1. Live PostgreSQL inventory.
    try:
        records = (
            db.query(Inventory, Product, Warehouse)
            .join(Product, Inventory.product_id == Product.id)
            .join(Warehouse, Inventory.warehouse_id == Warehouse.id)
            .all()
        )

        for inventory, product, warehouse in records:
            items.append({
                "sku": product.sku,
                "name": product.name,
                "category": product.category or "Components",
                "warehouse": warehouse.name,
                "warehouseLocation": warehouse.location or warehouse.name,
                "currentStock": int(inventory.stock_quantity or 0),
                "safetyStock": int(inventory.safety_stock_level or 0),
                "reorderLevel": int(inventory.reorder_level or 0),
                "reorderQuantity": int(inventory.reorder_quantity or 100),
                "unitPrice": float(product.price or 0.0),
                "leadTimeDays": 7,
                "dataSource": "postgresql_live",
                "hasHistoricalDemand": False,
                "description": (
                    f"Live database inventory record in {warehouse.name}. "
                    "Historical demand must be retrieved separately."
                ),
            })

    except Exception:
        logger.exception("Unable to retrieve PostgreSQL inventory.")
        # Do not silently substitute fake PostgreSQL inventory.
        # Dataset/demo items may still be returned below.

    # 2. Retail dataset products.
    retail_csv = _get_retail_csv_path()

    if retail_csv.is_file():
        actual_catalog = [
            ("P0001", "Groceries Item P0001", "Groceries",
             "Austin Retail Hub S001", "Austin, TX",
             231, 135, 150, 200, 33.50, 7),
            ("P0002", "Toys Item P0002", "Toys",
             "Dallas Retail Hub S001", "Dallas, TX",
             204, 144, 160, 200, 63.01, 7),
            ("P0003", "Toys Item P0003", "Toys",
             "West Regional Hub S001", "Phoenix, AZ",
             102, 74, 90, 150, 27.99, 5),
            ("P0004", "Toys Item P0004", "Toys",
             "North Distribution Hub S001", "Chicago, IL",
             469, 62, 100, 150, 32.72, 7),
            ("P0005", "Electronics Item P0005", "Electronics",
             "East Regional SuperHub S001", "Memphis, TN",
             166, 10, 50, 100, 73.64, 10),
        ]

        for (
            sku, name, category, warehouse, location,
            stock, safety, reorder_level, reorder_quantity, price, lead_time,
        ) in actual_catalog:
            items.append({
                "sku": sku,
                "name": name,
                "category": category,
                "warehouse": warehouse,
                "warehouseLocation": location,
                "currentStock": stock,
                "safetyStock": safety,
                "reorderLevel": reorder_level,
                "reorderQuantity": reorder_quantity,
                "unitPrice": price,
                "leadTimeDays": lead_time,
                "dataSource": "retail_dataset_actual",
                "hasHistoricalDemand": True,
                "description": (
                    "Retail dataset product. Historical observations are "
                    "loaded from the dataset when requested."
                ),
            })

    # 3. Deterministic demo products.
    demo_catalog = [
        ("IC-3NM-A18", "3nm Ultra AI Neural Processor",
         "Logic Silicon", "Giga Austin Warehouse", "Austin, TX",
         45000, 30000, 35000, 15000, 480.0, 7),
        ("HBM3E-24G", "High Bandwidth Memory 24GB",
         "Memory IC", "Memphis SuperHub", "Memphis, TN",
         18500, 25000, 28000, 10000, 320.0, 14),
    ]

    for (
        sku, name, category, warehouse, location,
        stock, safety, reorder_level, reorder_quantity, price, lead_time,
    ) in demo_catalog:
        items.append({
            "sku": sku,
            "name": name,
            "category": category,
            "warehouse": warehouse,
            "warehouseLocation": location,
            "currentStock": stock,
            "safetyStock": safety,
            "reorderLevel": reorder_level,
            "reorderQuantity": reorder_quantity,
            "unitPrice": price,
            "leadTimeDays": lead_time,
            "dataSource": "deterministic_demo",
            "hasHistoricalDemand": True,
            "description": "Deterministic simulated benchmark demand.",
        })

    # Avoid returning duplicate SKUs if a database happens to contain a
    # SKU that also appears in the demo or retail catalogue.
    unique_items: Dict[str, Dict[str, Any]] = {}

    for item in items:
        unique_items.setdefault(item["sku"].upper(), item)

    return list(unique_items.values())


@router.get(
    "/forecast/demand-history/{sku}",
    response_model=DemandHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve historical demand observations",
)
def get_demand_history_route(
    sku: str,
    store_id: str = "S001",
    limit: int = 90,
    db: Session = Depends(get_db),
):
    """Retrieve actual retail history or explicitly labelled demo history."""
    clean_sku = sku.strip().upper()

    if not clean_sku:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SKU cannot be empty.",
        )

    if limit < 1 or limit > 731:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="limit must be between 1 and 731.",
        )

    # Retail dataset products.
    if clean_sku.startswith("P") and clean_sku[1:].isdigit():
        retail_csv = _get_retail_csv_path()

        if not retail_csv.is_file():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Retail dataset not found: {retail_csv}",
            )

        try:
            from app.services.forecasting.data_loader import (
                load_retail_inventory_series,
            )

            df = load_retail_inventory_series(
                csv_path=str(retail_csv),
                store_id=store_id,
                product_id=clean_sku,
                target_col="units_sold",
            )

            df = df.tail(limit)

            points = [
                {
                    "date": str(row["date"])[:10],
                    "demand": float(row["demand"]),
                }
                for _, row in df.iterrows()
            ]

            if not points:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No retail demand observations found for {clean_sku}.",
                )

            return {
                "sku": clean_sku,
                "productName": f"Retail Product {clean_sku}",
                "dataSource": "retail_dataset_actual",
                "isSimulated": False,
                "totalObservations": len(points),
                "storeId": store_id,
                "historicalData": points,
            }

        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except (OSError, KeyError, pd.errors.ParserError):
            logger.exception("Failed to read retail demand for %s", clean_sku)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The retail dataset could not be read.",
            )

    # Deterministic demo SKU.
    if clean_sku == "IC-3NM-A18":
        points = [dict(point) for point in BENCHMARK_DEMO_DEMAND_A18]

        return {
            "sku": clean_sku,
            "productName": "3nm Ultra AI Neural Processor",
            "dataSource": "deterministic_demo",
            "isSimulated": True,
            "totalObservations": len(points),
            "storeId": "WH-AUSTIN-01",
            "historicalData": points,
        }

    if clean_sku == "HBM3E-24G":
        base_date = pd.Timestamp("2026-07-24")
        points = []

        for index in range(30):
            date_string = (
                base_date + pd.Timedelta(days=index)
            ).strftime("%Y-%m-%d")

            value = round(
                220.0
                + 35.0 * math.sin(index * 0.45)
                + (index % 7) * 4.0,
                1,
            )

            points.append({
                "date": date_string,
                "demand": value,
            })

        return {
            "sku": clean_sku,
            "productName": "High Bandwidth Memory 24GB",
            "dataSource": "deterministic_demo",
            "isSimulated": True,
            "totalObservations": len(points),
            "storeId": "WH-MEMPHIS-01",
            "historicalData": points,
        }

    # Registered PostgreSQL product without adequate daily history.
    product = db.query(Product).filter(Product.sku == clean_sku).first()

    if product:
        demand_obs = (
            db.query(DemandObservation)
            .filter(DemandObservation.product_id == product.id)
            .order_by(DemandObservation.observation_date.asc())
            .all()
        )
        if len(demand_obs) >= 1:
            points = [
                {
                    "date": d.observation_date.isoformat(),
                    "demand": float(d.quantity),
                }
                for d in demand_obs[-limit:]
            ]
            return {
                "sku": clean_sku,
                "productName": product.name,
                "dataSource": "postgresql_live",
                "isSimulated": False,
                "totalObservations": len(demand_obs),
                "storeId": str(demand_obs[0].warehouse_id),
                "historicalData": points,
            }

        sales_count = (
            db.query(Sales)
            .filter(Sales.product_id == product.id)
            .count()
        )
        order_items_count = (
            db.query(OrderItem)
            .filter(OrderItem.product_id == product.id)
            .count()
        )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Product '{clean_sku}' ({product.name}) exists in PostgreSQL, "
                f"but has insufficient historical demand observations: {len(demand_obs)} daily observations, "
                f"{sales_count} sales records, and {order_items_count} order line items were found. "
                "SynChain AI requires validated daily observations and "
                "never silently substitutes synthetic data into live production records."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Product SKU '{clean_sku}' was not found.",
    )


@router.post(
    "/forecast/demand",
    response_model=DemandForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate demand forecast",
)
@router.post(
    "/forecast",
    response_model=DemandForecastResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=True,
    summary="Legacy demand forecast endpoint",
)
async def generate_demand_forecast_route(request: DemandForecastRequest):
    """Generate a forecast without blocking the event loop."""
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

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception("Forecast computation failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Forecasting computation failed. Check the historical dates, "
                "demand values, and Prophet installation."
            ),
        ) from exc


@router.post(
    "/inventory/reorder-policy",
    response_model=InventoryPolicyResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate inventory replenishment policy",
)
@router.post(
    "/forecast/inventory/reorder-policy",
    response_model=InventoryPolicyResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def calculate_inventory_reorder_policy_route(
    request: InventoryPolicyRequest,
):
    """Calculate lead-time demand, safety stock, and reorder point."""
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

        if result.get("status") in {
            "insufficient_horizon",
            "insufficient_uncertainty_data",
        }:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.get(
                    "error_message",
                    "Insufficient data to calculate the inventory policy.",
                ),
            )

        result["productId"] = request.productId
        result["product_id"] = request.productId
        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Inventory policy calculation failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Inventory policy calculation failed.",
        ) from exc