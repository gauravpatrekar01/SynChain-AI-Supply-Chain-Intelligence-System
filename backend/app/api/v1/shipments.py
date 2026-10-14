from math import ceil
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.postgres.models import Shipment
from app.schemas.shipments import (
    ShipmentCreate,
    ShipmentUpdate,
    ShipmentResponse,
    ShipmentSummaryResponse,
    ShipmentListResponse,
    ShipmentRiskResponse,
)
from app.services.shipments.shipment_service import ShipmentService

router = APIRouter(prefix="/shipments", tags=["shipments"])


def _serialize_shipment(s: Shipment) -> ShipmentResponse:
    return ShipmentResponse(
        id=s.id,
        shipment_id=s.shipment_id,
        shipment_name=s.shipment_name,
        supplier_id=s.supplier_id,
        supplier_name=s.supplier.name if s.supplier else None,
        origin=s.origin,
        destination=s.destination,
        cargo_description=s.cargo_description,
        quantity=s.quantity,
        transport_mode=s.transport_mode,
        departure_date=s.departure_date,
        expected_delivery_date=s.expected_delivery_date,
        actual_delivery_date=s.actual_delivery_date,
        carrier_name=s.carrier_name,
        tracking_number=s.tracking_number,
        status=s.status,
        risk_score=s.risk_score,
        risk_level=s.risk_level,
        risk_factors=s.risk_factors or [],
        data_completeness=s.data_completeness,
        initial_risk_score=s.initial_risk_score,
        tracking_history=s.tracking_history or [],
        created_at=s.created_at,
        updated_at=s.updated_at,
        mode=(s.transport_mode or "ocean").lower(),
        carrier=s.carrier_name,
        cargoDescription=s.cargo_description,
        vesselName=s.shipment_name,
        speedKnots=22 if (s.transport_mode or "").lower() == "ocean" else (480 if (s.transport_mode or "").lower() == "air" else 65),
        eta=s.expected_delivery_date.strftime("%Y-%m-%d %H:%M UTC") if s.expected_delivery_date else "",
        rerouteRecommendation="Alternative corridor available with 0 penalty hours" if s.risk_score >= 60 or s.status == "delayed" else None,
    )


@router.get("/summary", response_model=ShipmentSummaryResponse)
def get_shipments_summary(db: Session = Depends(get_db)):
    """Returns aggregated real-time shipment counts and risk metrics."""
    return ShipmentService.get_summary(db)


@router.get("", response_model=Union[ShipmentListResponse, List[ShipmentResponse]])
def get_shipments(
    search: Optional[str] = Query(None, description="Search by ID, name, cargo, origin, dest, carrier, supplier"),
    status: Optional[str] = Query(None, description="Filter by status (in_transit, delivered, delayed, etc.)"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (LOW, MEDIUM, HIGH, CRITICAL)"),
    transport_mode: Optional[str] = Query(None, description="Filter by mode (Ocean, Air, Ground, Rail)"),
    sort_by: Optional[str] = Query("created_at", description="Sort field (eta, risk_score, status, departure_date)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    flat: bool = Query(False, description="Return raw list instead of paginated envelope"),
    db: Session = Depends(get_db),
):
    """Retrieve all shipments with rich filtering, search, sorting, and pagination."""
    items, total = ShipmentService.get_shipments(
        db=db,
        search=search,
        status_filter=status,
        risk_level=risk_level,
        transport_mode=transport_mode,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    serialized = [_serialize_shipment(s) for s in items]
    if flat:
        return serialized

    pages = ceil(total / page_size) if page_size > 0 else 1
    return ShipmentListResponse(
        items=serialized,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, pages),
    )


@router.post("", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)):
    """Create a new shipment record with backend risk scoring and persistence."""
    shipment = ShipmentService.create_shipment(db, payload)
    return _serialize_shipment(shipment)


@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment_by_id(shipment_id: str, db: Session = Depends(get_db)):
    """Retrieve single shipment details by UUID or business shipment_id."""
    shipment = ShipmentService.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with identifier '{shipment_id}' was not found.",
        )
    return _serialize_shipment(shipment)


@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(shipment_id: str, payload: ShipmentUpdate, db: Session = Depends(get_db)):
    """Update shipment details and automatically recalculate risk scores."""
    shipment = ShipmentService.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with identifier '{shipment_id}' was not found.",
        )
    updated = ShipmentService.update_shipment(db, shipment, payload)
    return _serialize_shipment(updated)


@router.delete("/{shipment_id}")
def delete_shipment(shipment_id: str, db: Session = Depends(get_db)):
    """Safely delete shipment record from database."""
    shipment = ShipmentService.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with identifier '{shipment_id}' was not found.",
        )
    assigned_id = shipment.shipment_id
    ShipmentService.delete_shipment(db, shipment)
    return {
        "success": True,
        "message": f"Shipment '{assigned_id}' has been permanently deleted.",
        "shipment_id": assigned_id,
    }


@router.get("/{shipment_id}/risk", response_model=ShipmentRiskResponse)
def get_shipment_risk(shipment_id: str, db: Session = Depends(get_db)):
    """Retrieve structured risk object for a shipment."""
    shipment = ShipmentService.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with identifier '{shipment_id}' was not found.",
        )
    return ShipmentRiskResponse(
        shipment_id=shipment.shipment_id,
        risk_score=shipment.risk_score,
        risk_level=shipment.risk_level,
        risk_factors=shipment.risk_factors or [],
        data_completeness=shipment.data_completeness,
        calculated_at=shipment.updated_at or shipment.created_at,
    )


@router.post("/{shipment_id}/recalculate-risk", response_model=ShipmentRiskResponse)
def recalculate_shipment_risk(shipment_id: str, db: Session = Depends(get_db)):
    """Explicitly trigger deterministic backend risk recalculation."""
    shipment = ShipmentService.get_by_id(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment with identifier '{shipment_id}' was not found.",
        )
    risk_data = ShipmentService.recalculate_risk(db, shipment)
    return ShipmentRiskResponse(**risk_data)
