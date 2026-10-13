from typing import Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_active_user
from app.models.postgres.models import User
from app.services.intelligence.intelligence_service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.post("/upload/{dataset_type}")
async def upload_dataset(
    dataset_type: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Upload and validate an ERP, WMS, or CSR CSV for downstream risk analysis."""
    try:
        return IntelligenceService.upload_dataset(str(current_user.id), dataset_type, file)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded CSV: {str(exc)}") from exc


@router.post("/analyze")
async def analyze_datasets(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Run transparent, rule-based supply-chain risk checks against the uploaded data."""
    try:
        return IntelligenceService.analyze_for_user(str(current_user.id))
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Failed to analyze datasets: {str(exc)}") from exc


@router.get("/results")
async def get_analysis_results(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Return the latest supply-chain intelligence results for the validated session."""
    try:
        result = IntelligenceService.get_results_for_user(str(current_user.id))
        if result is None:
            return {
                "analysis_status": "not_ready",
                "available_datasets": [],
                "message": "No uploaded datasets are available for this user yet.",
                "summary": {"total_risks": 0, "dataset_quality": "not_ready"},
                "risks": [],
                "recommendations": [],
                "limitations": ["No data has been uploaded for analysis."],
            }
        return result
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Failed to retrieve results: {str(exc)}") from exc
