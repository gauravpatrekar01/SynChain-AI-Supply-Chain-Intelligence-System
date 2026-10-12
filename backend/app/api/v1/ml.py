import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import User
from app.schemas.ml import (
    ShipmentPredictionRequest,
    ShipmentPredictionResponse,
    SupplierRecommendationRequest,
    SupplierRecommendationResponse,
    SupplierRecommendationItem,
    InventorySimulationRequest,
    InventorySimulationResponse,
    DecisionReportRequest,
    DecisionReportResponse,
    MLHealthResponse,
)
from app.services.ml.ml_service import MLIntelligenceService

router = APIRouter(prefix="/ml", tags=["machine-learning"])


@router.get("/health", response_model=MLHealthResponse)
async def get_ml_health():
    """
    Returns live health, readiness, and artifact validation status of the
    committed ML delay prediction model and supporting datasets.
    """
    health = await asyncio.to_thread(MLIntelligenceService.check_model_health)
    return health


@router.post(
    "/predict-delay",
    response_model=ShipmentPredictionResponse,
    status_code=status.HTTP_200_OK,
)
async def predict_shipment_delay(
    request: ShipmentPredictionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Estimates shipment delay probability and risk category using the committed
    RandomForest delay model pipeline.
    """
    try:
        payload = request.model_dump()
        result = await asyncio.to_thread(MLIntelligenceService.predict_shipment, payload)
        return result
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model artifact unavailable: {str(e)}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delay prediction failed: {str(e)}",
        )


@router.post(
    "/recommend-suppliers",
    response_model=SupplierRecommendationResponse,
    status_code=status.HTTP_200_OK,
)
async def recommend_suppliers(
    request: SupplierRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Ranks and recommends alternative suppliers for a given component and order size
    using ML delay probabilities and multi-criteria evaluation.
    """
    try:
        payload = request.model_dump()
        max_results = payload.pop("max_results", 5)
        recommendations = await asyncio.to_thread(
            MLIntelligenceService.recommend_suppliers,
            payload,
            max_results,
            db,
        )
        return {
            "recommendations": recommendations,
            "total_eligible": len(recommendations),
            "component_type": request.component_type,
            "order_quantity": request.order_quantity,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supplier recommendation failed: {str(e)}",
        )


@router.post(
    "/simulate-inventory",
    response_model=InventorySimulationResponse,
    status_code=status.HTTP_200_OK,
)
async def simulate_inventory(
    request: InventorySimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Simulates multi-scenario supply-chain inventory dynamics:
    1. Baseline (fixed lead time)
    2. Mitigated (alternative supplier selected via ML model)
    3. Automatic Replenishment (reorder point policy)
    """
    try:
        combined, summary = await asyncio.to_thread(
            MLIntelligenceService.run_inventory_simulation,
            request.initial_inventory,
            request.daily_demand,
            request.simulation_days,
            request.shipment_quantity,
            request.component_type or "Battery",
            db,
        )
        # Sample daily records to prevent excessive JSON payloads over the network
        sample_records = combined.head(60).to_dict(orient="records")

        return {
            "summary": summary,
            "daily_records_count": len(combined),
            "daily_records_sample": sample_records,
            "selected_supplier": summary.get("selected_supplier"),
            "replenishment_settings": summary.get("replenishment_settings"),
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inventory simulation failed: {str(e)}",
        )


@router.post(
    "/decision-report",
    response_model=DecisionReportResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_decision_report(
    request: DecisionReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generates an executive decision report comparing baseline, alternative supplier,
    and automatic replenishment options with operational recommendations.
    """
    try:
        report = await asyncio.to_thread(
            MLIntelligenceService.generate_decision_report,
            request.initial_inventory or 300,
            request.daily_demand or 100,
            request.simulation_days or 30,
            request.shipment_quantity or 1000,
            request.component_type or "Battery",
            None,
            db,
        )
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decision report generation failed: {str(e)}",
        )
