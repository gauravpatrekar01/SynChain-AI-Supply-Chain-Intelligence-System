from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator


VALID_TRANSPORT_MODES = {"ocean", "air", "ground", "rail", "road"}
VALID_STATUSES = {"in_transit", "delivered", "delayed", "pending", "cancelled"}


def normalize_transport_mode(mode: str) -> str:
    cleaned = (mode or "").strip().lower()
    if cleaned in ("ocean", "sea", "maritime"):
        return "Ocean"
    elif cleaned in ("air", "flight"):
        return "Air"
    elif cleaned in ("rail", "train"):
        return "Rail"
    elif cleaned in ("ground", "road", "truck"):
        return "Ground"
    return mode.title() if mode else "Ocean"


def normalize_status(status: str) -> str:
    cleaned = (status or "").strip().lower().replace(" ", "_")
    if cleaned in VALID_STATUSES:
        return cleaned
    if cleaned in ("completed", "arrived"):
        return "delivered"
    if cleaned in ("late", "critical"):
        return "delayed"
    return "in_transit"


class RiskFactorDetail(BaseModel):
    factor: str
    score: int = Field(ge=0, le=100)
    weight: float = Field(ge=0.0, le=1.0)
    available: bool
    description: Optional[str] = None


class ShipmentRiskResponse(BaseModel):
    shipment_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_level: str  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    risk_factors: List[RiskFactorDetail]
    data_completeness: str  # 'PARTIAL', 'COMPLETE'
    calculated_at: datetime


class ShipmentBase(BaseModel):
    shipment_id: Optional[str] = Field(default=None, max_length=100)
    shipment_name: str = Field(min_length=1, max_length=255)
    supplier_id: Optional[UUID] = None
    origin: str = Field(min_length=1, max_length=255)
    destination: str = Field(min_length=1, max_length=255)
    cargo_description: str = Field(min_length=1, max_length=255)
    quantity: int = Field(gt=0, default=1)
    transport_mode: str = Field(default="Ocean")
    departure_date: datetime
    expected_delivery_date: datetime
    actual_delivery_date: Optional[datetime] = None
    carrier_name: str = Field(min_length=1, max_length=255)
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = "in_transit"
    initial_risk_score: Optional[int] = Field(default=None, ge=0, le=100)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v

    @field_validator("transport_mode")
    @classmethod
    def validate_transport_mode(cls, v: str) -> str:
        mode_clean = (v or "").strip().lower()
        if mode_clean not in VALID_TRANSPORT_MODES:
            raise ValueError(f"Invalid transport mode: {v}. Must be Ocean, Air, Ground, or Rail.")
        return normalize_transport_mode(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> str:
        if not v:
            return "in_transit"
        return normalize_status(v)

    @model_validator(mode="after")
    def validate_dates(self) -> "ShipmentBase":
        if self.departure_date and self.expected_delivery_date:
            if self.expected_delivery_date < self.departure_date:
                raise ValueError("Expected delivery date (ETA) cannot be earlier than departure date")
        return self


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentUpdate(BaseModel):
    shipment_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    supplier_id: Optional[UUID] = None
    origin: Optional[str] = Field(default=None, min_length=1, max_length=255)
    destination: Optional[str] = Field(default=None, min_length=1, max_length=255)
    cargo_description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    quantity: Optional[int] = Field(default=None, gt=0)
    transport_mode: Optional[str] = None
    departure_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    carrier_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = None
    initial_risk_score: Optional[int] = Field(default=None, ge=0, le=100)

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v

    @field_validator("transport_mode")
    @classmethod
    def validate_transport_mode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            mode_clean = (v or "").strip().lower()
            if mode_clean not in VALID_TRANSPORT_MODES:
                raise ValueError(f"Invalid transport mode: {v}. Must be Ocean, Air, Ground, or Rail.")
            return normalize_transport_mode(v)
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return normalize_status(v)
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "ShipmentUpdate":
        if self.departure_date and self.expected_delivery_date:
            if self.expected_delivery_date < self.departure_date:
                raise ValueError("Expected delivery date (ETA) cannot be earlier than departure date")
        return self


class ShipmentResponse(BaseModel):
    id: UUID
    shipment_id: str
    shipment_name: str
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    origin: str
    destination: str
    cargo_description: str
    quantity: int
    transport_mode: str
    departure_date: datetime
    expected_delivery_date: datetime
    actual_delivery_date: Optional[datetime] = None
    carrier_name: str
    tracking_number: Optional[str] = None
    status: str
    risk_score: int
    risk_level: str
    risk_factors: Optional[List[RiskFactorDetail]] = None
    data_completeness: str = "PARTIAL"
    initial_risk_score: Optional[int] = None
    tracking_history: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Front-end / GeoMap compatibility fields
    mode: Optional[str] = None
    carrier: Optional[str] = None
    cargoDescription: Optional[str] = None
    vesselName: Optional[str] = None
    speedKnots: Optional[int] = None
    eta: Optional[str] = None
    rerouteRecommendation: Optional[str] = None

    model_config = {"from_attributes": True}


class ShipmentSummaryResponse(BaseModel):
    total_shipments: int
    in_transit: int
    delivered: int
    delayed: int
    high_risk: int
    critical_risk: int


class ShipmentListResponse(BaseModel):
    items: List[ShipmentResponse]
    total: int
    page: int
    page_size: int
    pages: int
