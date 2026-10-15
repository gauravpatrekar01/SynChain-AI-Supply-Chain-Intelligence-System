from math import ceil
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.inventory import (
    InventoryCreate,
    InventoryUpdate,
    InventoryResponse,
    InventoryListResponse,
    InventoryImportPreviewResponse,
    InventoryImportConfirmRequest,
    InventoryImportConfirmResponse,
    RecalculateBufferResponse,
    WarehouseOption,
    InventorySummaryStats,
)
from app.services.inventory.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/import/template")
def download_inventory_csv_template():
    """Generates and downloads a standardized CSV template for bulk product inventory ingestion."""
    csv_content = InventoryService.generate_csv_template()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="synchain_inventory_template.csv"',
        },
    )


@router.post("/import/preview", response_model=InventoryImportPreviewResponse)
async def preview_inventory_csv_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parses and validates uploaded CSV file, checking headers, formats, duplicate SKUs and routes."""
    file_bytes = await file.read()
    return InventoryService.preview_csv_import(file_bytes, file.filename or "inventory.csv", db)


@router.post("/import/confirm", response_model=InventoryImportConfirmResponse)
def confirm_inventory_csv_import(
    payload: InventoryImportConfirmRequest,
    db: Session = Depends(get_db),
):
    """Atomically commits validated CSV inventory records into PostgreSQL."""
    return InventoryService.confirm_csv_import(
        preview_token=payload.preview_token,
        mode=payload.mode,
        db=db,
    )


@router.post("/recalculate-buffer", response_model=RecalculateBufferResponse)
def recalculate_inventory_buffer(db: Session = Depends(get_db)):
    """Recalculates multi-echelon safety stock and reorder thresholds from actual saved data."""
    return InventoryService.recalculate_buffers(db)


@router.get("/warehouses", response_model=List[WarehouseOption])
def get_inventory_warehouses(db: Session = Depends(get_db)):
    """Retrieve list of active warehouses for dropdown selection."""
    return InventoryService.get_warehouses(db)


@router.get("/items", response_model=Union[InventoryListResponse, List[InventoryResponse]])
def get_inventory_items(
    search: Optional[str] = Query(None, description="Search by name, SKU, category, facility, or location"),
    category: Optional[str] = Query(None, description="Filter by product category"),
    facility: Optional[str] = Query(None, description="Filter by warehouse/facility name"),
    status: Optional[str] = Query(None, description="Filter by buffer status (optimal, warning, critical)"),
    sort_by: Optional[str] = Query("name", description="Sort by name, sku, category, facility, on_hand, safety_stock, buffer_health, created_at"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc, desc)"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    flat: bool = Query(False, description="Return raw list instead of paginated envelope"),
    db: Session = Depends(get_db),
):
    """Retrieve all inventory products from PostgreSQL with search, filtering, and summary metrics."""
    effective_page = page or 1
    effective_page_size = page_size or 100

    items, total, summary = InventoryService.get_items(
        db=db,
        search=search,
        category=category,
        facility=facility,
        status_filter=status,
        sort_by=sort_by,
        sort_order=sort_order,
        page=effective_page,
        page_size=effective_page_size,
    )
    serialized = [InventoryService.serialize_inventory(inv, db) for inv in items]

    if flat or (page is None and page_size is None):
        return serialized

    pages = ceil(total / effective_page_size) if effective_page_size > 0 else 1
    return InventoryListResponse(
        items=serialized,
        total=total,
        page=effective_page,
        page_size=effective_page_size,
        pages=max(1, pages),
        summary=summary,
    )


@router.post("/items", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(payload: InventoryCreate, db: Session = Depends(get_db)):
    """Manually add an inventory product into PostgreSQL."""
    inv = InventoryService.create_item(db, payload)
    return InventoryService.serialize_inventory(inv, db)


@router.get("/items/{item_id}", response_model=InventoryResponse)
def get_inventory_item_by_id(item_id: str, db: Session = Depends(get_db)):
    """Retrieve specific inventory product details by inventory UUID, SKU, or product ID."""
    inv = InventoryService.get_by_id(db, item_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item '{item_id}' not found.",
        )
    return InventoryService.serialize_inventory(inv, db)


@router.put("/items/{item_id}", response_model=InventoryResponse)
def update_inventory_item(item_id: str, payload: InventoryUpdate, db: Session = Depends(get_db)):
    """Update inventory product attributes, quantities, and buffer thresholds."""
    inv = InventoryService.get_by_id(db, item_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item '{item_id}' not found.",
        )
    updated = InventoryService.update_item(db, inv, payload)
    return InventoryService.serialize_inventory(updated, db)


@router.delete("/items/{item_id}")
def delete_inventory_item(item_id: str, db: Session = Depends(get_db)):
    """Safely delete inventory item, checking for foreign key constraints in orders, sales, and purchases."""
    inv = InventoryService.get_by_id(db, item_id)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item '{item_id}' not found.",
        )
    name = inv.product.name if inv.product else str(inv.id)
    sku = inv.product.sku if inv.product else ""
    InventoryService.delete_item(db, inv)
    return {
        "success": True,
        "message": f"Inventory item '{name}' ({sku}) has been safely deleted.",
        "item_id": item_id,
    }
