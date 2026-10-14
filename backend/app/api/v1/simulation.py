"""
API routes for the Supply Chain Decision Simulator.

Provides:
- POST /api/v1/simulation/decision : Multi-scenario simulation comparing baseline, disrupted, and alternative decisions.
- GET  /api/v1/simulation/suppliers: Verified suppliers for scenario configuration.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.decision_simulator import (
    DecisionSimulationRequest,
    DecisionSimulationResponse,
    SupplierListResponse,
)
from app.services.simulation.decision_simulator import DecisionSimulatorService

router = APIRouter(prefix="/simulation", tags=["simulation"])
decision_service = DecisionSimulatorService()


@router.get("/suppliers", response_model=SupplierListResponse)
def get_simulation_suppliers(db: Session = Depends(get_db)):
    """
    Returns available verified suppliers from PostgreSQL and the supplier master dataset.
    Includes lead times, reliability ratings, locations, and capacity constraints.
    """
    try:
        suppliers = decision_service.get_available_suppliers(db=db)
        return SupplierListResponse(total=len(suppliers), suppliers=suppliers)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load suppliers: {str(e)}"
        )


@router.post("/decision", response_model=DecisionSimulationResponse)
def run_decision_simulation(
    request: DecisionSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Executes a multi-scenario Decision Simulation comparing:
    - Baseline (normal supplier operations)
    - Disrupted (primary supplier delayed by disruption)
    - Alternative (switching to alternative supplier, if configured)

    Calculates daily inventory trajectories, stockout timings, unmet demand,
    safety-stock breaches, and produces an advisory decision recommendation.
    """
    try:
        response = decision_service.run_decision_simulation(request, db=db)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decision simulation failed: {str(e)}"
        )
