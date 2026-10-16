"""
Pydantic v2 schemas for SynChain AI Sales Data Ingestion and Forecasting module.
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict, AliasChoices


class SalesTransactionBase(BaseModel):
    transaction_id: str = Field(..., min_length=1, max_length=100, description="Unique transaction ID")
    transaction_date: datetime = Field(..., description="Date and time of sale")
    product_id: str = Field(..., min_length=1, max_length=100, description="Product SKU or ID")
    product_name: str = Field(..., min_length=1, max_length=255, description="Product Name")
    product_category: str = Field(default="General", min_length=1, max_length=255, description="Category")
    quantity_sold: int = Field(..., ge=1, description="Units sold")
    unit_selling_price: float = Field(..., ge=0.0, description="Unit selling price")
    discount_amount: float = Field(default=0.0, ge=0.0, description="Discount amount applied")
    region: str = Field(..., min_length=1, max_length=100, description="Sales region or territory")
    customer_id: Optional[str] = Field(default=None, max_length=100, description="Optional customer ID")
    order_id: Optional[str] = Field(default=None, max_length=100, description="Optional order ID")
    tax_amount: float = Field(default=0.0, ge=0.0, description="Tax amount")
    return_quantity: int = Field(default=0, ge=0, description="Returned units")
    currency: str = Field(default="USD", max_length=10, description="Currency code")

    @field_validator("transaction_id", "product_id", "product_name", "region")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        clean = (v or "").strip()
        if not clean:
            raise ValueError("Field cannot be empty")
        return clean

    @field_validator("return_quantity")
    @classmethod
    def validate_return_qty(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Return quantity cannot be negative")
        return v


class SalesTransactionCreate(SalesTransactionBase):
    pass


class SalesTransactionUpdate(BaseModel):
    transaction_date: Optional[datetime] = None
    product_name: Optional[str] = None
    product_category: Optional[str] = None
    quantity_sold: Optional[int] = Field(default=None, ge=1)
    unit_selling_price: Optional[float] = Field(default=None, ge=0.0)
    discount_amount: Optional[float] = Field(default=None, ge=0.0)
    region: Optional[str] = None
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    tax_amount: Optional[float] = Field(default=None, ge=0.0)
    return_quantity: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = None


class SalesTransactionResponse(SalesTransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    gross_revenue: float
    net_revenue: float
    import_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class SalesTransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[SalesTransactionResponse]
    summary: Dict[str, Any]


# --- Ingestion Schemas ---

class SalesCSVRowValidationError(BaseModel):
    row_number: int
    field: str
    value: Any
    message: str


class SalesUploadPreviewResponse(BaseModel):
    import_id: str
    filename: str
    total_rows_detected: int
    columns_detected: List[str]
    missing_required_columns: List[str]
    mapped_columns: Dict[str, str]
    preview_rows: List[Dict[str, Any]]
    validation_errors: List[SalesCSVRowValidationError]
    valid_rows_count: int
    invalid_rows_count: int
    duplicate_in_file_count: int
    existing_in_db_count: int
    is_importable: bool
    summary: Dict[str, Any]


class SalesImportExecuteRequest(BaseModel):
    import_id: str
    skip_duplicates: bool = True


class SalesImportSummaryResponse(BaseModel):
    import_id: str
    status: str
    total_records_processed: int
    imported_count: int
    duplicate_count: int
    rejected_count: int
    total_net_revenue: float
    total_units_sold: int
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    error_samples: List[str] = Field(default_factory=list)


# --- KPI and Overview Schemas ---

class SalesOverviewKPIs(BaseModel):
    total_revenue: float
    total_units_sold: int
    revenue_growth_mom: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    average_selling_price: float
    forecasted_revenue: Optional[float] = None
    forecast_accuracy: Optional[float] = None
    forecast_accuracy_metric: str = "WAPE"
    forecast_metric_wape: Optional[float] = None
    forecast_metric_rmse: Optional[float] = None
    forecast_metric_mae: Optional[float] = None
    total_transactions: int
    active_products_count: int
    active_regions_count: int
    data_freshness_timestamp: str
    has_data: bool


class MonthlyTrendPoint(BaseModel):
    year_month: str
    year: int
    month: int
    revenue: float
    gross_revenue: float
    units_sold: int
    asp: float
    transaction_count: int
    mom_growth_pct: Optional[float] = None


class QuarterlyTrendPoint(BaseModel):
    year_quarter: str
    year: int
    quarter: int
    revenue: float
    units_sold: int
    asp: float
    qoq_growth_pct: Optional[float] = None


class YoYComparisonPoint(BaseModel):
    period: str
    current_year: int
    previous_year: int
    current_year_revenue: float
    previous_year_revenue: float
    growth_pct: Optional[float] = None
    is_equivalent_period: bool = True


class ProductSalesContribution(BaseModel):
    product_id: str
    product_name: str
    category: str
    units_sold: int
    total_revenue: float
    asp: float
    revenue_share_pct: float
    trend_direction: str  # "growing", "declining", "stable"
    growth_pct: Optional[float] = None


class CategorySalesPerformance(BaseModel):
    category: str
    revenue: float
    units_sold: int
    revenue_share_pct: float
    product_count: int
    asp: float


class RegionalSalesPerformance(BaseModel):
    region: str
    revenue: float
    units_sold: int
    revenue_share_pct: float
    transaction_count: int
    asp: float


class HistoricalSalesAnalysisResponse(BaseModel):
    has_data: bool
    kpis: SalesOverviewKPIs
    monthly_trends: List[MonthlyTrendPoint]
    quarterly_trends: List[QuarterlyTrendPoint]
    yoy_comparison: List[YoYComparisonPoint]
    product_contributions: List[ProductSalesContribution]
    top_selling_products: List[ProductSalesContribution]
    declining_products: List[ProductSalesContribution]
    category_performance: List[CategorySalesPerformance]
    regional_performance: List[RegionalSalesPerformance]
    available_years: List[int]
    available_categories: List[str]
    available_regions: List[str]
    date_range_applied: Dict[str, Any]


# --- Forecasting Schemas ---

class SalesForecastPoint(BaseModel):
    date: str
    predicted_revenue: float
    confidence_lower: float
    confidence_upper: float
    predicted_units: float
    is_forecast: bool = True


class SalesForecastEvaluationMetrics(BaseModel):
    mae: float
    rmse: float
    wape: Optional[float] = None
    mape: Optional[float] = None
    accuracy_pct: Optional[float] = None
    sample_size: int
    evaluation_type: str = "Out-of-sample Chronological Backtest (80/20)"


class RevenueForecastResponse(BaseModel):
    has_data: bool
    has_sufficient_history: bool
    explanation: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    forecast_horizon_days: int
    forecast_start_date: Optional[str] = None
    forecast_end_date: Optional[str] = None
    historical_points: List[SalesForecastPoint]
    forecast_points: List[SalesForecastPoint]
    total_historical_revenue: float
    total_forecasted_revenue: float
    total_forecasted_units: float
    expected_revenue_growth_pct: Optional[float] = None
    model_name: str
    model_version: str
    interval_confidence_pct: int = 95
    metrics: Optional[SalesForecastEvaluationMetrics] = None
    data_freshness_timestamp: str
    limitations: List[str] = Field(default_factory=list)


# --- Scenario Schemas ---

class SalesScenarioRequest(BaseModel):
    scenario_name: str = Field(default="Base Scenario", max_length=100)
    horizon_days: int = Field(default=30, ge=7, le=365)
    volume_change_pct: float = Field(default=0.0, ge=-90.0, le=500.0)
    price_change_pct: float = Field(default=0.0, ge=-90.0, le=500.0)
    demand_shock_pct: float = Field(default=0.0, ge=-90.0, le=500.0)
    apply_fulfillment_constraints: bool = False
    product_id: Optional[str] = None
    product_category: Optional[str] = None


class SalesScenarioResponse(BaseModel):
    scenario_name: str
    horizon_days: int
    assumptions: Dict[str, Any]
    baseline_projected_units: float
    baseline_projected_revenue: float
    scenario_projected_units: float
    scenario_projected_revenue: float
    fulfilled_units: float
    unmet_units: float
    revenue_variance_usd: float
    revenue_variance_pct: float
    fulfillment_constrained: bool
    bottlenecks: List[str]
    formula_breakdown: Dict[str, str]
    daily_trajectory: List[Dict[str, Any]]


# --- Supply Chain Integration Schema ---

class SalesSupplyChainIntegrationItem(BaseModel):
    sales_product_id: str
    product_name: str
    category: str
    matched_db_product_id: Optional[str] = None
    matched_sku: Optional[str] = None
    available_stock_units: int
    safety_stock_units: int
    reorder_point: int
    incoming_shipment_units: int
    forecast_demand_units_30d: float
    forecast_demand_units_60d: float
    forecast_demand_units_90d: float
    stockout_predicted_30d: bool
    days_to_stockout: Optional[float] = None
    replenishment_shortfall_units: float
    component_mapping_status: str  # "1:1 Direct Product", "BOM Components Mapped", "No Component Mapping Available"
    recommended_action: str


class SalesSupplyChainIntegrationResponse(BaseModel):
    has_data: bool
    matched_products_count: int
    unmatched_products_count: int
    at_risk_stockout_count: int
    total_shortfall_units: float
    items: List[SalesSupplyChainIntegrationItem]
    summary_insight: str
