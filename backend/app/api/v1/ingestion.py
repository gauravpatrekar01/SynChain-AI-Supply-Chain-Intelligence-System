import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import User
from app.ingestion.service import IngestionService
from app.ingestion.normalizer import CANONICAL_SCHEMA

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class ValidateImportRequest(BaseModel):
    sheet_name: Optional[str] = None
    column_mapping: Optional[Dict[str, Optional[str]]] = None
    entity_type: Optional[str] = "multi"


class ExecuteImportRequest(BaseModel):
    sheet_name: Optional[str] = None
    column_mapping: Optional[Dict[str, Optional[str]]] = None
    entity_type: Optional[str] = "multi"


@router.get("/canonical-schema")
async def get_canonical_schema():
    """
    Returns the SynChain canonical supply-chain field definitions, labels, and aliases.
    """
    return {
        "fields": CANONICAL_SCHEMA
    }


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload CSV or Excel file (.csv, .xlsx, .xls), validate format and size,
    stage the file, and return detected sheets, columns, and sample preview.
    """
    result = await IngestionService.upload_and_stage(
        db=db,
        file=file,
        current_user=current_user
    )
    return result


@router.get("/{import_id}/preview")
async def get_file_preview(
    import_id: str,
    sheet: Optional[str] = Query(None, description="Sheet name for Excel workbooks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get preview rows, detected columns, and auto-mapping for a staged import session.
    """
    return IngestionService.get_preview(
        db=db,
        import_id=import_id,
        user_id=current_user.id,
        sheet_name=sheet
    )


@router.post("/{import_id}/validate")
async def validate_import_data(
    import_id: str,
    payload: ValidateImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Validate staged rows against supply-chain constraints and return user-friendly error summary.
    """
    return IngestionService.validate_import(
        db=db,
        import_id=import_id,
        user_id=current_user.id,
        sheet_name=payload.sheet_name,
        column_mapping=payload.column_mapping,
        entity_type=payload.entity_type
    )


@router.post("/{import_id}/import")
async def execute_data_import(
    import_id: str,
    payload: ExecuteImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Permanently import and normalize data into SynChain PostgreSQL database models
    with source tracking.
    """
    return IngestionService.execute_import(
        db=db,
        import_id=import_id,
        user_id=current_user.id,
        sheet_name=payload.sheet_name,
        column_mapping=payload.column_mapping,
        entity_type=payload.entity_type
    )


@router.get("/history")
async def get_import_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List historical data imports for the authenticated user.
    """
    return IngestionService.get_history(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
