"""
API routes for the SynChain Scenario Intelligence & AI Evidence Reports.

Provides:
- GET  /api/v1/scenario/readiness       : Assess data readiness of current DB records
- GET  /api/v1/scenario/config-options  : Verified products, suppliers, warehouses from DB
- POST /api/v1/scenario/simulate        : Execute multi-strategy simulation with AI explanations
- GET  /api/v1/scenario/reports         : List historical simulation evidence reports
- GET  /api/v1/scenario/reports/{id}    : Fetch detailed evidence report
- GET  /api/v1/scenario/reports/{id}/pdf: Download formatted ReportLab PDF evidence report
- GET  /api/v1/scenario/reports/{id}/export: Download structured evidence CSV/JSON
"""

from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
import json

from app.api.deps import get_db, get_optional_current_user
from app.models.postgres.models import User
from app.schemas.scenario_intelligence import (
    DataReadinessCheck,
    ScenarioConfigOptionsResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    SimulationEvidenceReportSummary,
)
from app.services.simulation.scenario_intelligence_service import ScenarioIntelligenceService

router = APIRouter(prefix="/scenario", tags=["scenario-intelligence"])


@router.get("/readiness", response_model=DataReadinessCheck)
def get_scenario_readiness(db: Session = Depends(get_db)):
    """
    Assesses operational data readiness for running scenario simulations.
    Inspects live products, suppliers, warehouses, inventory, and shipment counts.
    """
    return ScenarioIntelligenceService.assess_data_readiness(db)


@router.get("/config-options", response_model=ScenarioConfigOptionsResponse)
def get_scenario_config_options(db: Session = Depends(get_db)):
    """
    Returns actual verified database entities for scenario builder pickers.
    Never fabricates fictional supplier IDs.
    """
    return ScenarioIntelligenceService.get_config_options(db)


@router.post("/simulate", response_model=ScenarioSimulationResponse)
def run_scenario_simulation(
    request: ScenarioSimulationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Executes a multi-strategy deterministic simulation comparing:
    - Baseline
    - Disrupted (unmitigated)
    - 4 Mitigation strategies (Switch, Split, Expedite, Accept)

    Generates Gemini decision intelligence (or transparent deterministic fallback),
    computes calculation transparency, and persists an immutable evidence report.
    """
    try:
        user_id = current_user.id if current_user else None
        return ScenarioIntelligenceService.simulate_scenario(
            request=request,
            db=db,
            current_user_id=user_id,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation failed: {str(e)}",
        )


@router.get("/reports", response_model=List[SimulationEvidenceReportSummary])
def list_simulation_reports(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Lists historical persistent simulation evidence reports.
    """
    return ScenarioIntelligenceService.list_reports(db, limit=limit)


@router.get("/reports/{report_id}")
def get_simulation_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Retrieves a complete historical evidence report by its unique report ID.
    """
    report = ScenarioIntelligenceService.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' not found.",
        )
    return report


@router.get("/reports/{report_id}/pdf")
def download_report_pdf(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Generates and downloads a publication-grade ReportLab PDF Evidence Report.
    """
    report = ScenarioIntelligenceService.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' not found.",
        )
    try:
        pdf_bytes = ScenarioIntelligenceService.generate_pdf_report(report)
        filename = f"SynChain_Evidence_Report_{report_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF evidence report: {str(e)}",
        )


@router.get("/reports/{report_id}/export")
def download_report_export(
    report_id: str,
    format: Literal["csv", "json"] = Query(default="csv"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Exports structured simulation evidence data in CSV or JSON format.
    """
    report = ScenarioIntelligenceService.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with ID '{report_id}' not found.",
        )
    try:
        if format == "json":
            content = json.dumps(report, indent=2, default=str)
            filename = f"SynChain_Evidence_Data_{report_id}.json"
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        else:
            csv_content = ScenarioIntelligenceService.export_evidence_csv(report)
            filename = f"SynChain_Evidence_Data_{report_id}.csv"
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export evidence data: {str(e)}",
        )
