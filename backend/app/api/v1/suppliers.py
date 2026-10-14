from math import ceil
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.suppliers import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierListResponse,
    SupplierImportPreviewResponse,
    SupplierImportConfirmRequest,
    SupplierImportConfirmResponse,
)
from app.services.suppliers.supplier_service import SupplierService

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("/import/template")
def download_supplier_csv_template():
    """Generates and downloads a standardized CSV template for bulk supplier ingestion."""
    csv_content = SupplierService.generate_csv_template()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="synchain_suppliers_template.csv"',
        },
    )


@router.post("/import/preview", response_model=SupplierImportPreviewResponse)
async def preview_supplier_csv_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parses and validates uploaded CSV file, checking column mappings, format, and duplicates."""
    file_bytes = await file.read()
    return SupplierService.preview_csv_import(file_bytes, file.filename or "suppliers.csv", db)


@router.post("/import/confirm", response_model=SupplierImportConfirmResponse)
def confirm_supplier_csv_import(
    payload: SupplierImportConfirmRequest,
    db: Session = Depends(get_db),
):
    """Atomically commits validated CSV supplier records into PostgreSQL."""
    return SupplierService.confirm_csv_import(
        preview_token=payload.preview_token,
        mode=payload.mode,
        db=db,
    )


@router.get("", response_model=Union[SupplierListResponse, List[SupplierResponse]])
def get_suppliers(
    search: Optional[str] = Query(None, description="Search by name, code, category, location, country"),
    tier: Optional[str] = Query(None, description="Filter by Tier (Tier-1, Tier-2, all)"),
    health_status: Optional[str] = Query(None, description="Filter by health/risk status (optimal, warning, critical)"),
    is_active: Optional[str] = Query(None, description="Filter by active status (true, false, all)"),
    sort_by: Optional[str] = Query("name", description="Sort by name, reliability, spend, health_status, created_at"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc, desc)"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    flat: bool = Query(False, description="Return raw list instead of paginated envelope"),
    db: Session = Depends(get_db),
):
    """Retrieve all suppliers with search, filtering, and sorting."""
    # If page/page_size not provided and flat not explicitly False, default to full list for backward compatibility
    effective_page = page or 1
    effective_page_size = page_size or 200

    items, total = SupplierService.get_suppliers(
        db=db,
        search=search,
        tier=tier,
        health_status=health_status,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
        page=effective_page,
        page_size=effective_page_size,
    )
    serialized = [SupplierService.serialize_supplier(s, db) for s in items]

    if flat or (page is None and page_size is None):
        return serialized

    pages = ceil(total / effective_page_size) if effective_page_size > 0 else 1
    return SupplierListResponse(
        items=serialized,
        total=total,
        page=effective_page,
        page_size=effective_page_size,
        pages=max(1, pages),
    )


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    """Manually register a new supplier in PostgreSQL."""
    supplier = SupplierService.create_supplier(db, payload)
    return SupplierService.serialize_supplier(supplier, db)


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier_by_id(supplier_id: str, db: Session = Depends(get_db)):
    """Retrieve detailed supplier profile by UUID or supplier_code."""
    supplier = SupplierService.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier '{supplier_id}' not found in registry.",
        )
    return SupplierService.serialize_supplier(supplier, db)


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: str, payload: SupplierUpdate, db: Session = Depends(get_db)):
    """Update supplier attributes in database."""
    supplier = SupplierService.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier '{supplier_id}' not found in registry.",
        )
    updated = SupplierService.update_supplier(db, supplier, payload)
    return SupplierService.serialize_supplier(updated, db)


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: str, db: Session = Depends(get_db)):
    """Safely delete supplier, checking for related foreign keys in shipments or orders."""
    supplier = SupplierService.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier '{supplier_id}' not found in registry.",
        )
    name = supplier.name
    code = supplier.supplier_code or str(supplier.id)
    SupplierService.delete_supplier(db, supplier)
    return {
        "success": True,
        "message": f"Supplier '{name}' ({code}) has been permanently deleted.",
        "supplier_id": code,
    }
