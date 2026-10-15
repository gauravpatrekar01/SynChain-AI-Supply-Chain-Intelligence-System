import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict, AliasChoices, computed_field

VALID_STATUSES = {"optimal", "warning", "critical"}


def normalize_status(st: Optional[str]) -> str:
    cleaned = (st or "optimal").strip().lower()
    if cleaned in ("optimal", "healthy", "good", "normal"):
        return "optimal"
    elif cleaned in ("warning", "low", "medium", "moderate"):
        return "warning"
    elif cleaned in ("critical", "high", "danger", "stockout"):
        return "critical"
    return "optimal"


class InventoryBase(BaseModel):
    sku: str = Field(min_length=1, max_length=100, validation_alias=AliasChoices('sku', 'product_code', 'code', 'productCode'))
    name: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices('name', 'product_name', 'productName'))
    category: str = Field(default="General", min_length=1, max_length=255, validation_alias=AliasChoices('category', 'product_category', 'productCategory'))
    price: float = Field(default=100.0, ge=0.0, validation_alias=AliasChoices('price', 'unit_price', 'unitPrice'))
    warehouse_id: Optional[UUID] = Field(default=None, validation_alias=AliasChoices('warehouse_id', 'warehouseId'))
    warehouse_name: Optional[str] = Field(default=None, max_length=255, validation_alias=AliasChoices('warehouse_name', 'warehouse', 'facility', 'warehouseName'))
    on_hand_quantity: int = Field(default=0, ge=0, validation_alias=AliasChoices('on_hand_quantity', 'stock_quantity', 'on_hand', 'onHandUnits', 'onHandQuantity', 'stockQuantity'))
    reserved_quantity: int = Field(default=0, ge=0, validation_alias=AliasChoices('reserved_quantity', 'reserved', 'reservedUnits', 'reservedQuantity'))
    safety_stock: int = Field(default=0, ge=0, validation_alias=AliasChoices('safety_stock', 'safety_stock_level', 'safetyStockUnits', 'safetyStock', 'safetyFloor'))
    reorder_point: int = Field(default=0, ge=0, validation_alias=AliasChoices('reorder_point', 'reorder_level', 'reorder_trigger', 'reorderPoint', 'reorderLevel', 'reorderTrigger'))
    reorder_quantity: int = Field(default=0, ge=0, validation_alias=AliasChoices('reorder_quantity', 'reorder_qty', 'reorderQuantity'))
    average_daily_demand: Optional[float] = Field(default=None, ge=0.0, validation_alias=AliasChoices('average_daily_demand', 'daily_demand', 'averageDailyDemand'))
    lead_time_days: Optional[int] = Field(default=None, ge=0, validation_alias=AliasChoices('lead_time_days', 'lead_time', 'leadTimeDays'))

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = (v or "").strip()
        if not clean:
            raise ValueError("Product name cannot be blank")
        return clean

    @field_validator("sku")
    @classmethod
    def validate_sku(cls, v: str) -> str:
        clean = (v or "").strip()
        if not clean:
            raise ValueError("SKU / Product Code cannot be blank")
        return clean

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = (v or "").strip()
        return clean or "General"

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return round(float(v), 2)

    @field_validator("on_hand_quantity", "reserved_quantity", "safety_stock", "reorder_point", "reorder_quantity")
    @classmethod
    def validate_non_negative_int(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Quantities cannot be negative")
        return int(v)

    @field_validator("reserved_quantity")
    @classmethod
    def validate_reserved(cls, v: int, info) -> int:
        on_hand = info.data.get("on_hand_quantity")
        if on_hand is not None and v > on_hand:
            raise ValueError(f"Reserved quantity ({v}) cannot exceed on-hand quantity ({on_hand})")
        return int(v)


class InventoryCreate(InventoryBase):
    pass


class InventoryUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, min_length=1, max_length=255)
    price: Optional[float] = Field(default=None, ge=0.0)
    warehouse_id: Optional[UUID] = None
    warehouse_name: Optional[str] = Field(default=None, max_length=255)
    on_hand_quantity: Optional[int] = Field(default=None, ge=0)
    reserved_quantity: Optional[int] = Field(default=None, ge=0)
    safety_stock: Optional[int] = Field(default=None, ge=0)
    reorder_point: Optional[int] = Field(default=None, ge=0)
    reorder_quantity: Optional[int] = Field(default=None, ge=0)
    average_daily_demand: Optional[float] = Field(default=None, ge=0.0)
    lead_time_days: Optional[int] = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if not clean:
                raise ValueError("Product name cannot be blank")
            return clean
        return None

    @field_validator("sku")
    @classmethod
    def validate_sku(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if not clean:
                raise ValueError("SKU cannot be blank")
            return clean
        return None


class InventoryResponse(BaseModel):
    id: UUID
    product_id: UUID
    warehouse_id: UUID
    sku: str
    name: str
    category: str
    price: float
    facility: str
    location: Optional[str] = None
    country: Optional[str] = None
    on_hand_units: int
    reserved_units: int
    available_units: int
    safety_stock_units: int
    reorder_trigger: int
    reorder_quantity: int
    average_daily_demand: Optional[float] = None
    lead_time_days: Optional[int] = None
    days_of_supply: Optional[float] = None
    buffer_health_percentage: float
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Frontend camelCase compatibility aliases
    onHandUnits: Optional[int] = None
    reservedUnits: Optional[int] = None
    availableUnits: Optional[int] = None
    safetyStockUnits: Optional[int] = None
    reorderTrigger: Optional[int] = None
    reorderQuantity: Optional[int] = None
    daysOfSupply: Optional[float] = None
    bufferPct: Optional[float] = None
    averageDailyDemand: Optional[float] = None
    leadTimeDays: Optional[int] = None

    # Forecasting consumer compatibility aliases
    currentStock: Optional[int] = None
    current_stock: Optional[int] = None
    safetyStock: Optional[int] = None
    safety_stock: Optional[int] = None
    reorderLevel: Optional[int] = None
    reorder_level: Optional[int] = None
    unitPrice: Optional[float] = None
    unit_price: Optional[float] = None
    dataSource: Optional[str] = "postgresql_live"
    data_source: Optional[str] = "postgresql_live"
    warehouse: Optional[str] = None
    warehouseLocation: Optional[str] = None
    warehouse_location: Optional[str] = None
    hasHistoricalDemand: Optional[bool] = False
    has_historical_demand: Optional[bool] = False
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, extra="allow")


class InventorySummaryStats(BaseModel):
    total_products: int
    total_on_hand_units: int
    total_safety_stock_units: int
    total_inventory_value_usd: float
    critical_count: int
    warning_count: int
    optimal_count: int


class InventoryListResponse(BaseModel):
    items: List[InventoryResponse]
    total: int
    page: int
    page_size: int
    pages: int
    summary: InventorySummaryStats


class InventoryImportRowError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str
    raw_data: Optional[Dict[str, Any]] = None


class InventoryImportPreviewResponse(BaseModel):
    preview_token: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: List[InventoryImportRowError]
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


class InventoryImportConfirmRequest(BaseModel):
    preview_token: str
    mode: str = "skip_duplicates"  # 'skip_duplicates' or 'fail_on_duplicates'


class InventoryImportConfirmResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    invalid_count: int
    imported_items: List[InventoryResponse]
    errors: List[InventoryImportRowError]


class RecalculateBufferResponse(BaseModel):
    success: bool
    message: str
    total_items: int
    recalculated_count: int
    statistical_count: int
    parametric_count: int
    insufficient_data_count: int
    details: List[Dict[str, Any]]


class WarehouseOption(BaseModel):
    id: UUID
    name: str
    location: Optional[str] = "Primary Facility"
    country: Optional[str] = "Global"

    model_config = ConfigDict(from_attributes=True)
