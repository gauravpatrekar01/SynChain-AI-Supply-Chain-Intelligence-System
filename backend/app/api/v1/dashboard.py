from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import User
from app.schemas.dashboard import (
    DashboardOverviewResponse,
    DashboardTrendsResponse,
    DashboardRiskItem,
    DashboardAlertItem,
    DashboardRecommendationItem,
    ScenarioSimulateRequest,
)
from app.services.dashboard.analytics_service import DashboardAnalyticsService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns aggregated KPIs derived from actual available supply chain data."""
    try:
        overview = DashboardAnalyticsService.get_overview(db)
        return DashboardOverviewResponse(**overview)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard overview: {str(e)}")


@router.get("/trends", response_model=DashboardTrendsResponse)
async def get_dashboard_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns time-series data for dashboard charts (ingestion, inventory velocity, forecasts, risk distribution)."""
    try:
        trends = DashboardAnalyticsService.get_trends(db)
        return DashboardTrendsResponse(**trends)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate trends: {str(e)}")


@router.get("/risks", response_model=List[DashboardRiskItem])
async def get_dashboard_risks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns current supply-chain risks and their contributing factors calculated using the XGBoost risk engine."""
    try:
        risks = DashboardAnalyticsService.get_risks(db)
        return [DashboardRiskItem(**r) for r in risks]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute supply chain risks: {str(e)}")


@router.get("/alerts", response_model=List[DashboardAlertItem])
async def get_dashboard_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns real alerts generated from inventory levels, satellite weather, disruption news, and integration health."""
    try:
        alerts = await DashboardAnalyticsService.get_alerts(db)
        return [DashboardAlertItem(**a) for a in alerts]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to aggregate alerts: {str(e)}")


@router.get("/recommendations", response_model=List[DashboardRecommendationItem])
async def get_dashboard_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns mitigation recommendations produced by the analytical engine."""
    try:
        recs = DashboardAnalyticsService.get_recommendations(db)
        return [DashboardRecommendationItem(**r) for r in recs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")


@router.post("/scenarios/simulate")
async def simulate_scenario(
    request: ScenarioSimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Runs a non-destructive what-if scenario simulation using validated baseline data and analytical logic."""
    try:
        result = DashboardAnalyticsService.simulate_scenario(request.model_dump(), db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute scenario simulation: {str(e)}")
