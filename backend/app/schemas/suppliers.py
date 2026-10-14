import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict, AliasChoices, computed_field

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

VALID_TIERS = {"tier-1", "tier-2", "tier 1", "tier 2", "1", "2"}
VALID_HEALTH_STATUSES = {"optimal", "warning", "critical", "low", "medium", "high"}


def normalize_tier(tier_str: Optional[str]) -> str:
    cleaned = (tier_str or "Tier-1").strip().lower()
    if cleaned in ("tier-2", "tier 2", "2"):
        return "Tier-2"
    return "Tier-1"


def normalize_health_status(st: Optional[str]) -> str:
    cleaned = (st or "optimal").strip().lower()
    if cleaned in ("low", "optimal", "healthy", "good"):
        return "optimal"
    elif cleaned in ("medium", "warning", "moderate"):
        return "warning"
    elif cleaned in ("high", "critical", "severe"):
        return "critical"
    return "optimal"


class SupplierBase(BaseModel):
    supplier_code: Optional[str] = Field(default=None, max_length=100, validation_alias=AliasChoices('supplier_code', 'code', 'supplierCode'))
    name: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices('name', 'supplier_name', 'supplierName'))
    tier: str = Field(default="Tier-1", max_length=50)
    category: str = Field(default="Component Supplier", min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    country: str = Field(default="Global", min_length=1, max_length=100)
    contact_person: Optional[str] = Field(default=None, max_length=255, validation_alias=AliasChoices('contact_person', 'contact', 'contactPerson'))
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=100)
    reliability_score: float = Field(default=85.0, ge=0.0, le=100.0, validation_alias=AliasChoices('reliability_score', 'reliability', 'reliabilityScore'))
    quality_rating: Optional[float] = Field(default=None, ge=0.0, le=100.0, validation_alias=AliasChoices('quality_rating', 'quality', 'qualityRating'))
    spend_annual_usd: float = Field(default=0.0, ge=0.0, validation_alias=AliasChoices('spend_annual_usd', 'spend_usd', 'spendAnnualUsd', 'annual_spend'))
    health_status: str = Field(default="optimal", max_length=50, validation_alias=AliasChoices('health_status', 'healthStatus', 'risk_rating'))
    single_source_risk: bool = Field(default=False, validation_alias=AliasChoices('single_source_risk', 'single_source', 'singleSourceRisk'))
    lead_time_days: Optional[int] = Field(default=None, ge=0, validation_alias=AliasChoices('lead_time_days', 'lead_time', 'leadTimeDays'))
    capacity: Optional[int] = Field(default=None, ge=0)
    is_active: bool = Field(default=True, validation_alias=AliasChoices('is_active', 'isActive', 'active'))

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = (v or "").strip()
        if not clean:
            raise ValueError("Supplier name cannot be blank")
        return clean

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, v: str) -> str:
        return normalize_tier(v)

    @field_validator("health_status")
    @classmethod
    def validate_health(cls, v: str) -> str:
        return normalize_health_status(v)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            clean = v.strip()
            if not EMAIL_REGEX.match(clean):
                raise ValueError(f"Invalid email address format: {v}")
            return clean
        return None

    @field_validator("spend_annual_usd")
    @classmethod
    def validate_spend(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Annual spend cannot be negative")
        return round(float(v), 2)

    @field_validator("reliability_score")
    @classmethod
    def validate_rel(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("Reliability score must be between 0 and 100")
        return round(float(v), 2)

    @field_validator("quality_rating")
    @classmethod
    def validate_qual(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if not (0.0 <= v <= 100.0):
                raise ValueError("Quality rating must be between 0 and 100")
            return round(float(v), 2)
        return None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    supplier_code: Optional[str] = Field(default=None, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tier: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = Field(default=None, min_length=1, max_length=255)
    location: Optional[str] = Field(default=None, max_length=255)
    country: Optional[str] = Field(default=None, min_length=1, max_length=100)
    contact_person: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=100)
    reliability_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    quality_rating: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    spend_annual_usd: Optional[float] = Field(default=None, ge=0.0)
    health_status: Optional[str] = None
    single_source_risk: Optional[bool] = None
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    capacity: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if not clean:
                raise ValueError("Supplier name cannot be blank")
            return clean
        return None

    @field_validator("tier")
    @classmethod
    def validate_tier(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return normalize_tier(v)
        return None

    @field_validator("health_status")
    @classmethod
    def validate_health(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return normalize_health_status(v)
        return None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            clean = v.strip()
            if not EMAIL_REGEX.match(clean):
                raise ValueError(f"Invalid email address format: {v}")
            return clean
        return None

    @field_validator("spend_annual_usd")
    @classmethod
    def validate_spend(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Annual spend cannot be negative")
        return round(float(v), 2) if v is not None else None

    @field_validator("reliability_score")
    @classmethod
    def validate_rel(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("Reliability score must be between 0 and 100")
        return round(float(v), 2) if v is not None else None

    @field_validator("quality_rating")
    @classmethod
    def validate_qual(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if not (0.0 <= v <= 100.0):
                raise ValueError("Quality rating must be between 0 and 100")
            return round(float(v), 2)
        return None


class SupplierResponse(BaseModel):
    id: UUID
    supplier_code: Optional[str] = None
    name: str
    tier: str
    category: str
    location: Optional[str] = None
    country: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    reliability_score: float
    quality_rating: Optional[float] = None
    spend_annual_usd: float
    health_status: str
    single_source_risk: bool
    lead_time_days: Optional[int] = None
    capacity: Optional[int] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Relationship counts / metadata
    active_shipments_count: int = 0

    # Legacy frontend compatibility aliases (camelCase)
    reliabilityScore: Optional[float] = None
    spendAnnualUsd: Optional[float] = None
    healthStatus: Optional[str] = None
    singleSourceRisk: Optional[bool] = None

    @computed_field
    @property
    def single_source(self) -> bool:
        return self.single_source_risk

    @computed_field
    @property
    def spend_usd(self) -> float:
        return self.spend_annual_usd

    model_config = ConfigDict(from_attributes=True)


class SupplierListResponse(BaseModel):
    items: List[SupplierResponse]
    total: int
    page: int
    page_size: int
    pages: int


class SupplierImportRowError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str
    raw_data: Optional[Dict[str, Any]] = None


class SupplierImportPreviewResponse(BaseModel):
    preview_token: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: List[SupplierImportRowError]
    preview_records: List[Dict[str, Any]]

    @computed_field
    @property
    def valid_count(self) -> int:
        return self.valid_rows

    @computed_field
    @property
    def invalid_count(self) -> int:
        return self.invalid_rows

    @computed_field
    @property
    def duplicate_count(self) -> int:
        return self.duplicate_rows

    @computed_field
    @property
    def error_count(self) -> int:
        return len(self.errors)

    @computed_field
    @property
    def rows(self) -> List[Dict[str, Any]]:
        return self.preview_records


class SupplierImportConfirmRequest(BaseModel):
    preview_token: str
    mode: str = "skip_duplicates"  # 'skip_duplicates' or 'fail_on_duplicates'


class SupplierImportConfirmResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    invalid_count: int
    imported_suppliers: List[SupplierResponse]
    errors: List[SupplierImportRowError]
