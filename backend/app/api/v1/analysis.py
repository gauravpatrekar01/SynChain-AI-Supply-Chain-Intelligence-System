"""
FastAPI Routes for the SynChain AI Supply Chain Analysis Module.

Endpoints:
- GET   /api/v1/analysis/overview
- GET   /api/v1/analysis/risks
- GET   /api/v1/analysis/risks/{risk_id}
- GET   /api/v1/analysis/shipments
- GET   /api/v1/analysis/suppliers
- GET   /api/v1/analysis/inventory
- GET   /api/v1/analysis/forecasts
- POST  /api/v1/analysis/simulate
- GET   /api/v1/analysis/recommendations
- PATCH /api/v1/analysis/recommendations/{recommendation_id}
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.analysis import (
    AnalysisOverviewResponse,
    RiskRegisterListResponse,
    RiskDetailResponse,
    ShipmentAnalysisListResponse,
    SupplierAnalysisListResponse,
    InventoryAnalysisListResponse,
    ForecastAnalysisListResponse,
    AnalysisSimulationRequest,
    AnalysisSimulationResponse,
    AnalysisRecommendationsListResponse,
    RecommendationStatusUpdateRequest,
)
from app.services.analysis.analysis_service import AnalysisService
from app.services.analysis.scenario_simulation_service import ScenarioSimulationService
from app.services.analysis.recommendation_service import RecommendationService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get(
    "/overview",
    response_model=AnalysisOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve high-level supply chain health KPIs, distributions, and top risks",
)
def get_analysis_overview(db: Session = Depends(get_db)):
    """Returns aggregated real-time metrics computed directly from database tables."""
    try:
        return AnalysisService.get_overview(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate analysis overview: {str(exc)}",
        ) from exc


@router.get(
    "/risks",
    response_model=RiskRegisterListResponse,
    status_code=status.HTTP_200_OK,
    summary="Unified supply chain risk register with filtering, search, and pagination",
)
def get_risk_register(
    category: Optional[str] = Query(None, description="Filter by risk category"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    search: Optional[str] = Query(None, description="Text search by entity name, ID, or impact"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """Returns a prioritized list of unified risks across shipments, suppliers, and inventory."""
    try:
        return AnalysisService.get_risk_register(
            db=db,
            category=category,
            severity=severity,
            search=search,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve risk register: {str(exc)}",
        ) from exc


@router.get(
    "/risks/{risk_id}",
    response_model=RiskDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve detailed calculation, evidence, and consequences for a specific risk",
)
def get_risk_detail(risk_id: str, db: Session = Depends(get_db)):
    """Returns transparent evidence, calculation formula, and mitigation options."""
    try:
        return AnalysisService.get_risk_detail(db, risk_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load risk detail for '{risk_id}': {str(exc)}",
        ) from exc


@router.get(
    "/shipments",
    response_model=ShipmentAnalysisListResponse,
    status_code=status.HTTP_200_OK,
    summary="Deep shipment risk and delay analysis",
)
def get_shipments_analysis(db: Session = Depends(get_db)):
    """Returns evaluated shipment lateness, corridor risk, carrier performance, and explanations."""
    try:
        return AnalysisService.get_shipments_analysis(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze shipments: {str(exc)}",
        ) from exc


@router.get(
    "/suppliers",
    response_model=SupplierAnalysisListResponse,
    status_code=status.HTTP_200_OK,
    summary="Comprehensive supplier reliability and risk profile evaluation",
)
def get_suppliers_analysis(db: Session = Depends(get_db)):
    """Returns supplier performance, single-source vulnerabilities, and alternative sourcing profiles."""
    try:
        return AnalysisService.get_suppliers_analysis(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze suppliers: {str(exc)}",
        ) from exc


@router.get(
    "/inventory",
    response_model=InventoryAnalysisListResponse,
    status_code=status.HTTP_200_OK,
    summary="Inventory buffer coverage and stockout exposure evaluation",
)
def get_inventory_analysis(db: Session = Depends(get_db)):
    """Returns buffer health %, days of supply, safety stock breach checks, and stockout estimates."""
    try:
        return AnalysisService.get_inventory_analysis(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze inventory buffers: {str(exc)}",
        ) from exc


@router.get(
    "/forecasts",
    response_model=ForecastAnalysisListResponse,
    status_code=status.HTTP_200_OK,
    summary="Demand forecast vs inventory position analysis",
)
def get_forecasts_analysis(db: Session = Depends(get_db)):
    """Integrates forecast projections with available inventory to identify replenishment deadlines."""
    try:
        return AnalysisService.get_forecasts_analysis(db)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze forecasts: {str(exc)}",
        ) from exc


@router.post(
    "/simulate",
    response_model=AnalysisSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate and compare Wait vs Alternative Supplier vs Expedite decision pathways",
)
def run_scenario_simulation(payload: AnalysisSimulationRequest):
    """
    Evaluates 30-day inventory trajectories, stockout timings, unmet demand,
    and financial exposure across 3 alternative responses to supply disruption.
    """
    try:
        return ScenarioSimulationService.run_simulation(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Simulation calculation failed: {str(exc)}",
        ) from exc


@router.get(
    "/recommendations",
    response_model=AnalysisRecommendationsListResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve explainable, prioritized recommendations with lifecycle statuses",
)
def get_recommendations(db: Session = Depends(get_db)):
    """Derives actionable recommendations directly from ground-truth risk conditions."""
    try:
        recs = RecommendationService.generate_recommendations(db)
        open_count = sum(1 for r in recs if r.status in ("Open", "Reviewed"))
        resolved_count = sum(1 for r in recs if r.status in ("Accepted", "Resolved"))
        return AnalysisRecommendationsListResponse(
            total=len(recs),
            open_count=open_count,
            resolved_count=resolved_count,
            recommendations=recs,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load recommendations: {str(exc)}",
        ) from exc


@router.patch(
    "/recommendations/{recommendation_id}",
    status_code=status.HTTP_200_OK,
    summary="Update recommendation review status (Open, Reviewed, Accepted, Rejected, Resolved)",
)
def update_recommendation_status(
    recommendation_id: str,
    payload: RecommendationStatusUpdateRequest,
):
    """Persists updated status for a recommendation."""
    try:
        return RecommendationService.update_recommendation_status(
            rec_id=recommendation_id,
            status=payload.status,
            notes=payload.notes,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update recommendation status: {str(exc)}",
        ) from exc
