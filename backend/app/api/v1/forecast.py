"""
Forecast and Inventory Decision API routes for SynChain AI.

Provides demand forecasting, historical-demand retrieval, and inventory
replenishment decisions.
"""

import asyncio
import importlib.metadata
import logging
import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
from app.services.forecasting.baseline_forecast import (
    BaselineForecaster,
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
baseline_service = BaselineForecaster()
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
    "/forecast/inventory-items",
    response_model=List[InventoryItemResponse],
    status_code=status.HTTP_200_OK,
    summary="List forecasting inventory catalog items",
)
@router.get(
    "/inventory/items",
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
                f"but historical demand is insufficient: {len(demand_obs)} daily observations, "
                f"{sales_count} sales records, and {order_items_count} order line items were found. "
                "SynChain AI requires validated daily observations and synthetic data will not be substituted into live production records."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Product SKU '{clean_sku}' was not found.",
    )


def _calculate_forecast_inventory_projection(
    forecast_points: List[Dict[str, Any]],
    current_stock: float,
    safety_stock: float,
    reorder_point: float,
    lead_time_days: int = 7,
    reorder_quantity: float = 100.0,
) -> Dict[str, Any]:
    """
    Simulates multi-horizon daily inventory depletion and automated replenishment.
    """
    stock = float(current_stock)
    ss = float(safety_stock)
    rop = float(reorder_point)
    lt = max(1, int(lead_time_days))
    qty = max(1.0, float(reorder_quantity))

    pending_orders: List[Dict[str, Any]] = []
    projections: List[Dict[str, Any]] = []
    stockout_day = None
    stockout_date = None
    total_demand = 0.0

    for day_idx, pt in enumerate(forecast_points, start=1):
        date_str = pt.get("date", f"Day {day_idx}")
        demand_val = float(pt.get("predictedDemandUnits", pt.get("predicted_demand", 0.0)))
        total_demand += demand_val

        # Deliver pending orders due today
        replenishment_today = 0.0
        remaining_orders = []
        for order in pending_orders:
            if order["arrival_day"] == day_idx:
                replenishment_today += order["quantity"]
            else:
                remaining_orders.append(order)
        pending_orders = remaining_orders

        # Update stock position
        stock_with_inflow = stock + replenishment_today
        stock_after_demand = max(0.0, stock_with_inflow - demand_val)
        stock = stock_after_demand

        # Record first stockout day
        if stock == 0.0 and stockout_day is None:
            stockout_day = day_idx
            stockout_date = date_str

        # Place reorder when stock drops to or below ROP (if no order currently in transit)
        if stock <= rop and len(pending_orders) == 0:
            order_qty = max(qty, math.ceil(rop - stock + (demand_val * lt)))
            pending_orders.append({
                "arrival_day": day_idx + lt,
                "quantity": order_qty
            })

        # Classification
        if stock == 0.0:
            buf_status = "stockout"
        elif stock < ss:
            buf_status = "critical"
        elif stock <= rop:
            buf_status = "warning"
        else:
            buf_status = "optimal"

        proj_item = {
            "day": day_idx,
            "date": date_str,
            "demand": round(demand_val, 2),
            "projectedStock": round(stock, 1),
            "safetyStockFloor": round(ss, 1),
            "reorderTriggerPoint": round(rop, 1),
            "replenishmentUnits": round(replenishment_today, 1),
            "status": buf_status,
        }
        projections.append(proj_item)
        pt["projectedStock"] = round(stock, 1)
        pt["safetyStockFloor"] = round(ss, 1)
        pt["reorderTriggerPoint"] = round(rop, 1)
        pt["replenishmentUnits"] = round(replenishment_today, 1)

    horizon = len(forecast_points)
    avg_daily_demand = total_demand / max(1, horizon)
    days_of_supply = round(current_stock / avg_daily_demand, 1) if avg_daily_demand > 0 else 999.0

    return {
        "projections": projections,
        "daysOfSupply": days_of_supply,
        "stockoutDay": stockout_day,
        "stockoutDate": stockout_date,
        "reorderRequired": current_stock <= rop,
        "averageDailyDemand": round(avg_daily_demand, 2),
    }


def _generate_forecast_alerts_and_recommendations(
    historical_data: List[Dict[str, Any]],
    forecast_points: List[Dict[str, Any]],
    current_stock: Optional[float],
    safety_stock: Optional[float],
    reorder_point: Optional[float],
    lead_time_days: int,
    reorder_quantity: float,
    stockout_day: Optional[int],
    stockout_date: Optional[str],
    days_of_supply: Optional[float],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Generates explainable operational alerts and recommendations from forecast results."""
    alerts = []
    recommendations = []

    # 1. Demand Surge Check
    hist_demands = [
        float(p.get("demand", p.get("actualDemandUnits", 0.0)))
        for p in historical_data
        if p.get("demand") is not None or p.get("actualDemandUnits") is not None
    ]
    hist_avg = sum(hist_demands) / max(1, len(hist_demands)) if hist_demands else 0.0
    fcast_demands = [float(p.get("predictedDemandUnits", 0.0)) for p in forecast_points]
    fcast_avg = sum(fcast_demands) / max(1, len(fcast_demands)) if fcast_demands else 0.0

    if hist_avg > 0 and fcast_avg > hist_avg * 1.20:
        surge_pct = round(((fcast_avg - hist_avg) / hist_avg) * 100, 1)
        alerts.append({
            "id": "alert-demand-surge",
            "type": "demand_surge",
            "severity": "warning",
            "title": f"Projected Demand Surge (+{surge_pct}%)",
            "description": f"Forecasted average daily demand ({round(fcast_avg, 1)} units) is {surge_pct}% above historical baseline ({round(hist_avg, 1)} units).",
            "metric": f"+{surge_pct}%",
        })
        recommendations.append({
            "id": "rec-surge-buffer",
            "category": "Buffer Adjustment",
            "priority": "HIGH",
            "action": f"Adjust safety stock target upward by {min(50, int(surge_pct * 0.5))}% to prevent buffer depletion under surge velocity.",
            "rationale": f"Demand velocity increases by {surge_pct}%, risking premature safety stock breaches before standard replenishment arrivals.",
        })

    # 2. Stockout Check
    if stockout_day is not None and stockout_date:
        alerts.append({
            "id": "alert-stockout-imminent",
            "type": "stockout_risk",
            "severity": "critical",
            "title": f"Stockout Predicted on Day {stockout_day} ({stockout_date})",
            "description": f"Warehouse inventory is projected to reach zero units on {stockout_date} at the forecasted consumption rate.",
            "metric": f"Day {stockout_day}",
        })
        expedite_window = max(1, stockout_day - lead_time_days)
        recommendations.append({
            "id": "rec-stockout-mitigation",
            "category": "Emergency Replenishment",
            "priority": "CRITICAL",
            "action": f"Initiate expedited procurement within {expedite_window} calendar days or arrange priority air freight with primary supplier.",
            "rationale": f"Depletion to zero units occurs on Day {stockout_day}, leaving insufficient lead time ({lead_time_days} days) for normal replenishment.",
        })
    elif days_of_supply is not None and days_of_supply < float(lead_time_days):
        alerts.append({
            "id": "alert-lead-time-breach",
            "type": "lead_time_risk",
            "severity": "critical",
            "title": f"Lead Time Exceeds Days of Supply ({days_of_supply}d < {lead_time_days}d)",
            "description": f"Only {days_of_supply} days of inventory remain, which is shorter than the {lead_time_days}-day supplier procurement lead time.",
            "metric": f"{days_of_supply}d supply",
        })
        recommendations.append({
            "id": "rec-lead-time-action",
            "category": "Procurement Expedite",
            "priority": "CRITICAL",
            "action": f"Place immediate order for {int(reorder_quantity or 100)} units and request expedited fulfillment from supplier.",
            "rationale": f"Negative lead-time gap of {round(lead_time_days - days_of_supply, 1)} days poses an imminent stockout risk.",
        })

    # 3. Reorder Point Trigger
    if current_stock is not None and reorder_point is not None and current_stock <= reorder_point:
        alerts.append({
            "id": "alert-reorder-triggered",
            "type": "reorder_point",
            "severity": "warning" if (safety_stock is not None and current_stock > safety_stock) else "critical",
            "title": "Inventory Has Reached Reorder Point (ROP)",
            "description": f"Current stock ({int(current_stock)} units) is at or below the reorder trigger threshold ({int(reorder_point)} units).",
            "metric": f"{int(current_stock)} / {int(reorder_point)} ROP",
        })
        recommendations.append({
            "id": "rec-reorder-standard",
            "category": "Standard Order",
            "priority": "HIGH",
            "action": f"Release standard replenishment order of {int(reorder_quantity or 100)} units to maintain {int(safety_stock or 0)} unit safety floor.",
            "rationale": f"Current inventory level triggers replenishment according to the inventory decision policy.",
        })

    # Default positive recommendation if optimal
    if not recommendations:
        recommendations.append({
            "id": "rec-optimal-buffer",
            "category": "Policy Monitoring",
            "priority": "LOW",
            "action": "Maintain normal procurement schedule. Inventory buffers are sufficient to fulfill demand across the forecast horizon.",
            "rationale": "Projected inventory remains above safety stock thresholds throughout the evaluation period.",
        })

    return alerts, recommendations


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
    """Generate a multi-horizon forecast with statistical baseline and inventory projection."""
    try:
        # 1. Primary Prophet forecast
        result = await asyncio.to_thread(
            forecast_service.generate_demand_forecast,
            historical_data=request.historicalData,
            horizon=request.horizonDays,
            evaluate=request.evaluate,
            interval_width=request.intervalWidth,
        )

        # 2. Comparative statistical baseline forecaster (AR-7 + Linear Trend)
        baseline_forecast = []
        baseline_metrics = None
        try:
            bf = BaselineForecaster()
            base_res = await asyncio.to_thread(
                bf.fit_and_forecast,
                historical_data=request.historicalData,
                horizon=request.horizonDays,
                evaluate=request.evaluate,
            )
            baseline_forecast = base_res.get("forecast", [])
            baseline_metrics = base_res.get("metrics")
        except Exception:
            logger.warning("Baseline forecaster failed, continuing with Prophet.")

        # Harmonize baseline into forecast points
        forecast_pts = result.get("forecast", [])
        for i, pt in enumerate(forecast_pts):
            if i < len(baseline_forecast):
                pt["historicalBaseline"] = baseline_forecast[i].get("predictedDemandUnits")
            else:
                pt["historicalBaseline"] = pt.get("predictedDemandUnits")

        result["baselineForecast"] = baseline_forecast
        result["baselineMetrics"] = baseline_metrics

        # 3. Date boundaries and granularity
        if forecast_pts:
            result["startDate"] = forecast_pts[0].get("date")
            result["endDate"] = forecast_pts[-1].get("date")
        result["granularity"] = "Daily"
        result["dataFreshnessTimestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 4. Inventory projection over the horizon
        stock_val = request.currentStock
        safety_val = request.safetyStock or 0.0
        rop_val = request.reorderPoint or (safety_val + 50.0)
        lt_val = request.leadTimeDays or 7
        ro_qty = request.reorderQuantity or 100.0

        stockout_day = None
        stockout_date = None
        days_of_supply = None
        reorder_req = None

        if stock_val is not None:
            inv_calc = _calculate_forecast_inventory_projection(
                forecast_points=forecast_pts,
                current_stock=stock_val,
                safety_stock=safety_val,
                reorder_point=rop_val,
                lead_time_days=lt_val,
                reorder_quantity=ro_qty,
            )
            result["inventoryProjections"] = inv_calc["projections"]
            result["daysOfSupply"] = inv_calc["daysOfSupply"]
            result["estimatedStockoutDay"] = inv_calc["stockoutDay"]
            result["estimatedStockoutDate"] = inv_calc["stockoutDate"]
            result["reorderRequired"] = inv_calc["reorderRequired"]
            stockout_day = inv_calc["stockoutDay"]
            stockout_date = inv_calc["stockoutDate"]
            days_of_supply = inv_calc["daysOfSupply"]
            reorder_req = inv_calc["reorderRequired"]

        # 5. Alerts and Recommendations
        alerts, recommendations = _generate_forecast_alerts_and_recommendations(
            historical_data=request.historicalData,
            forecast_points=forecast_pts,
            current_stock=stock_val,
            safety_stock=safety_val,
            reorder_point=rop_val,
            lead_time_days=lt_val,
            reorder_quantity=ro_qty,
            stockout_day=stockout_day,
            stockout_date=stockout_date,
            days_of_supply=days_of_supply,
        )
        result["alerts"] = alerts
        result["recommendations"] = recommendations

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
        logger.exception("Forecast computation failed.")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Forecast computation failed. Check the historical dates, "
                "demand values, and Prophet installation."
            ),
        ) from exc


@router.get(
    "/forecast/plan/{sku}",
    response_model=DemandForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate complete multi-horizon forecast and inventory plan for a SKU",
)
async def get_forecast_plan_route(
    sku: str,
    horizon: int = 30,
    lead_time: int = 7,
    db: Session = Depends(get_db),
):
    """Retrieve history, inventory levels, and compute multi-horizon forecast and replenishment projections."""
    clean_sku = sku.strip().upper()
    if horizon not in (30, 60, 90, 180):
        if horizon < 1 or horizon > 365:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Horizon must be between 1 and 365 days (typically 30, 60, or 90).",
            )

    # 1. Fetch verified historical observations
    history_resp = get_demand_history_route(sku=clean_sku, limit=180, db=db)
    historical_points = history_resp.get("historicalData", [])
    if len(historical_points) < 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"SKU '{clean_sku}' has fewer than 5 historical demand observations; insufficient for time-series forecasting.",
        )

    # 2. Look up inventory catalog item
    items = get_inventory_items_route(db=db)
    matched_item = next((it for it in items if it["sku"].upper() == clean_sku), None)

    current_stock = matched_item["currentStock"] if matched_item else 100.0
    safety_stock = matched_item["safetyStock"] if matched_item else 50.0
    reorder_level = matched_item["reorderLevel"] if matched_item else 75.0
    reorder_qty = matched_item["reorderQuantity"] if matched_item else 100.0
    lead_days = matched_item["leadTimeDays"] if matched_item else lead_time

    req = DemandForecastRequest(
        productId=clean_sku,
        historicalData=historical_points,
        horizonDays=horizon,
        intervalWidth=0.95,
        evaluate=True,
        currentStock=float(current_stock),
        safetyStock=float(safety_stock),
        reorderPoint=float(reorder_level),
        leadTimeDays=lead_days,
        reorderQuantity=float(reorder_qty),
    )
    return await generate_demand_forecast_route(req)


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