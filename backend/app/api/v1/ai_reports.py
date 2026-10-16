"""Authenticated read-only report generation over shared workspace aggregates."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import User
from app.schemas.ai_reports import AIReport, ReportFocus, ReportRequest
from app.services.ai_context import build_ai_context
from app.services.ai_report_service import ai_report_service

router = APIRouter(prefix="/ai", tags=["ai-reports"])
logger = logging.getLogger(__name__)


def get_report_context(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    # A sync dependency keeps SQLAlchemy work out of the async provider request.
    try:
        return build_ai_context(db)
    except SQLAlchemyError as exc:
        logger.warning("AI context database read failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Supply-chain data is temporarily unavailable.") from None


@router.post("/reports/generate", response_model=AIReport)
async def generate_report(request: ReportRequest, context: dict = Depends(get_report_context)):
    """Generate an advisory narrative; never modify orders or send email."""
    return await ai_report_service.generate_report(context, request.focus)


@router.get("/insights", response_model=AIReport)
def get_insights(focus: ReportFocus = Query(default="overview"), context: dict = Depends(get_report_context)):
    """Return current evidence-based insights without an external model call."""
    return ai_report_service.get_insights(context, focus)
