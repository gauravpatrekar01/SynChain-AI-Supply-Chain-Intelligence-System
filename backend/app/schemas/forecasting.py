"""
Pydantic v2 schemas for SynChain AI Demand Forecasting and Inventory Decision modules.
Supports dual camelCase and snake_case contracts for frontend and backend compatibility.
"""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict, AliasChoices, model_validator


class HistoricalDataPoint(BaseModel):
    """Represents a single historical demand observation."""
    date: str = Field(..., description="Date of observation (YYYY-MM-DD)")
    demand: float = Field(..., description="Observed demand units")

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class DemandForecastRequest(BaseModel):
    """Request payload for demand forecasting."""
    productId: Optional[str] = Field(
        "default",
        validation_alias=AliasChoices("productId", "product_id"),
        serialization_alias="productId",
        description="Product or SKU identifier"
    )
    historicalData: List[Dict[str, Any]] = Field(
        ...,
        validation_alias=AliasChoices("historicalData", "historical_data"),
        serialization_alias="historicalData",
        description="Historical demand observations with date and demand fields"
    )
    horizonDays: int = Field(
        30,
        gt=0,
        le=365,
        validation_alias=AliasChoices("horizonDays", "horizon_days", "horizon"),
        serialization_alias="horizonDays",
        description="Forecast horizon in calendar days (must be positive, <= 365)"
    )
    intervalWidth: float = Field(
        0.95,
        gt=0.50,
        lt=1.00,
        validation_alias=AliasChoices("intervalWidth", "interval_width"),
        serialization_alias="intervalWidth",
        description="Prediction interval confidence level (strictly between 0.50 and 1.00)"
    )
    evaluate: bool = Field(
        True,
        description="Whether to perform out-of-sample holdout backtest evaluation"
    )

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ForecastPoint(BaseModel):
    """Forward forecast or historical alignment point adhering to frontend contract."""
    date: str
    predictedDemandUnits: float
    confidenceLower: float
    confidenceUpper: float
    actualDemandUnits: Optional[float] = None
    historicalBaseline: Optional[float] = None
    predicted_demand: Optional[float] = None
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    trend: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class ForecastMetrics(BaseModel):
    """Out-of-sample evaluation metrics."""
    mae: Optional[float] = None
    rmse: Optional[float] = None
    wape: Optional[float] = None
    mape: Optional[float] = None
    mape_status: Optional[str] = None
    sample_size: Optional[int] = None
    evaluation_split: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class DemandForecastResponse(BaseModel):
    """Demand forecast response exposing both camelCase and snake_case fields."""
    status: str = "success"
    productId: Optional[str] = Field(None, validation_alias=AliasChoices("productId", "product_id"), serialization_alias="productId")
    product_id: Optional[str] = None
    algorithm: str
    modelVersion: str = Field(..., validation_alias=AliasChoices("modelVersion", "model_version"), serialization_alias="modelVersion")
    model_version: Optional[str] = None
    horizon: int
    metrics: Optional[Dict[str, Any]] = None
    forecast: List[Dict[str, Any]]
    historical: List[Dict[str, Any]] = Field(default_factory=list)
    all_points: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_dual_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Synchronize productId
            pid = data.get("productId", data.get("product_id"))
            data["productId"] = pid
            data["product_id"] = pid
            # Synchronize modelVersion
            mv = data.get("modelVersion", data.get("model_version"))
            data["modelVersion"] = mv
            data["model_version"] = mv
        return data


class InventoryPolicyRequest(BaseModel):
    """Request payload for inventory reorder policy calculation."""
    productId: Optional[str] = Field(
        "default",
        validation_alias=AliasChoices("productId", "product_id"),
        serialization_alias="productId",
        description="Product or SKU identifier"
    )
    forecastPoints: Union[List[float], List[Dict[str, Any]]] = Field(
        ...,
        validation_alias=AliasChoices("forecastPoints", "forecast_points", "forecast", "demand_forecast"),
        serialization_alias="forecastPoints",
        description="Sequence of forecasted daily demand values or forecast point objects"
    )
    leadTimeDays: int = Field(
        ...,
        ge=1,
        validation_alias=AliasChoices("leadTimeDays", "lead_time_days"),
        serialization_alias="leadTimeDays",
        description="Supplier replenishment lead time in days (must be >= 1)"
    )
    targetServiceLevel: float = Field(
        0.95,
        gt=0.50,
        lt=1.00,
        validation_alias=AliasChoices("targetServiceLevel", "target_service_level", "service_level"),
        serialization_alias="targetServiceLevel",
        description="Target cycle service level CSL (strictly between 0.50 and 1.00)"
    )
    leadTimeStdDays: float = Field(
        0.0,
        ge=0.0,
        validation_alias=AliasChoices("leadTimeStdDays", "lead_time_std_days"),
        serialization_alias="leadTimeStdDays",
        description="Standard deviation of supplier lead time in days"
    )
    dailyForecastRmse: Optional[float] = Field(
        None,
        ge=0.0,
        validation_alias=AliasChoices("dailyForecastRmse", "daily_forecast_rmse", "rmse"),
        serialization_alias="dailyForecastRmse",
        description="Daily forecast RMSE from evaluation metrics"
    )
    cumulativeLeadTimeErrors: Optional[List[float]] = Field(
        None,
        validation_alias=AliasChoices("cumulativeLeadTimeErrors", "cumulative_lead_time_errors"),
        serialization_alias="cumulativeLeadTimeErrors",
        description="Empirical cumulative lead-time forecast errors from rolling backtests"
    )
    holdingCostPerUnit: Optional[float] = Field(
        None,
        gt=0.0,
        validation_alias=AliasChoices("holdingCostPerUnit", "holding_cost_per_unit"),
        serialization_alias="holdingCostPerUnit",
        description="Holding cost per unit per period"
    )
    stockoutCostPerUnit: Optional[float] = Field(
        None,
        gt=0.0,
        validation_alias=AliasChoices("stockoutCostPerUnit", "stockout_cost_per_unit"),
        serialization_alias="stockoutCostPerUnit",
        description="Stockout / shortage penalty cost per unit"
    )
    currentStock: Optional[float] = Field(
        None,
        ge=0.0,
        validation_alias=AliasChoices("currentStock", "current_stock", "stock"),
        serialization_alias="currentStock",
        description="Current on-hand inventory units available in the warehouse"
    )
    standardReorderQuantity: Optional[float] = Field(
        None,
        ge=0.0,
        validation_alias=AliasChoices("standardReorderQuantity", "standard_reorder_quantity", "reorder_quantity"),
        serialization_alias="standardReorderQuantity",
        description="Standard batch reorder quantity if configured in ERP"
    )

    model_config = ConfigDict(populate_by_name=True, extra="allow")


class LeadTimeDemandBounds(BaseModel):
    """Lower and upper bounds of expected lead-time demand."""
    lower: float
    upper: float
    nominalCoveragePct: float = Field(
        ...,
        validation_alias=AliasChoices("nominalCoveragePct", "nominal_coverage_pct"),
        serialization_alias="nominalCoveragePct"
    )
    nominal_coverage_pct: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_coverage(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cov = data.get("nominalCoveragePct", data.get("nominal_coverage_pct"))
            data["nominalCoveragePct"] = cov
            data["nominal_coverage_pct"] = cov
        return data


class InventoryPolicyResponse(BaseModel):
    """Inventory decision response exposing both camelCase and snake_case fields."""
    status: str = "success"
    productId: Optional[str] = Field(None, validation_alias=AliasChoices("productId", "product_id"), serialization_alias="productId")
    product_id: Optional[str] = None
    leadTimeDays: int = Field(..., validation_alias=AliasChoices("leadTimeDays", "lead_time_days"), serialization_alias="leadTimeDays")
    lead_time_days: Optional[int] = None
    targetServiceLevel: float = Field(..., validation_alias=AliasChoices("targetServiceLevel", "target_service_level"), serialization_alias="targetServiceLevel")
    target_service_level: Optional[float] = None
    expectedLeadTimeDemand: Optional[float] = Field(None, validation_alias=AliasChoices("expectedLeadTimeDemand", "expected_lead_time_demand"), serialization_alias="expectedLeadTimeDemand")
    expected_lead_time_demand: Optional[float] = None
    safetyStock: Optional[float] = Field(None, validation_alias=AliasChoices("safetyStock", "safety_stock"), serialization_alias="safetyStock")
    safety_stock: Optional[float] = None
    reorderPoint: Optional[float] = Field(None, validation_alias=AliasChoices("reorderPoint", "reorder_point"), serialization_alias="reorderPoint")
    reorder_point: Optional[float] = None
    currentStock: Optional[float] = Field(None, validation_alias=AliasChoices("currentStock", "current_stock"), serialization_alias="currentStock")
    current_stock: Optional[float] = None
    recommendedReorderQuantity: Optional[float] = Field(None, validation_alias=AliasChoices("recommendedReorderQuantity", "recommended_reorder_quantity"), serialization_alias="recommendedReorderQuantity")
    recommended_reorder_quantity: Optional[float] = None
    reorderRequired: Optional[bool] = Field(None, validation_alias=AliasChoices("reorderRequired", "reorder_required"), serialization_alias="reorderRequired")
    reorder_required: Optional[bool] = None
    dataSource: Optional[str] = Field(None, validation_alias=AliasChoices("dataSource", "data_source"), serialization_alias="dataSource")
    data_source: Optional[str] = None
    leadTimeUncertaintySigma: Optional[float] = Field(None, validation_alias=AliasChoices("leadTimeUncertaintySigma", "lead_time_uncertainty_sigma"), serialization_alias="leadTimeUncertaintySigma")
    lead_time_uncertainty_sigma: Optional[float] = None
    leadTimeDemandBounds: Optional[Dict[str, Any]] = Field(None, validation_alias=AliasChoices("leadTimeDemandBounds", "lead_time_demand_bounds"), serialization_alias="leadTimeDemandBounds")
    lead_time_demand_bounds: Optional[Dict[str, Any]] = None
    methodUsed: Optional[str] = Field(None, validation_alias=AliasChoices("methodUsed", "method_used"), serialization_alias="methodUsed")
    method_used: Optional[str] = None
    criticalFractile: Optional[float] = Field(None, validation_alias=AliasChoices("criticalFractile", "critical_fractile"), serialization_alias="criticalFractile")
    critical_fractile: Optional[float] = None
    leadTimeStdDays: Optional[float] = Field(None, validation_alias=AliasChoices("leadTimeStdDays", "lead_time_std_days"), serialization_alias="leadTimeStdDays")
    lead_time_std_days: Optional[float] = None
    assumptions: List[str] = Field(default_factory=list)
    errorMessage: Optional[str] = Field(None, validation_alias=AliasChoices("errorMessage", "error_message"), serialization_alias="errorMessage")
    error_message: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_cases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pairs = [
                ("productId", "product_id"),
                ("leadTimeDays", "lead_time_days"),
                ("targetServiceLevel", "target_service_level"),
                ("expectedLeadTimeDemand", "expected_lead_time_demand"),
                ("safetyStock", "safety_stock"),
                ("reorderPoint", "reorder_point"),
                ("currentStock", "current_stock"),
                ("recommendedReorderQuantity", "recommended_reorder_quantity"),
                ("reorderRequired", "reorder_required"),
                ("dataSource", "data_source"),
                ("leadTimeUncertaintySigma", "lead_time_uncertainty_sigma"),
                ("leadTimeDemandBounds", "lead_time_demand_bounds"),
                ("methodUsed", "method_used"),
                ("criticalFractile", "critical_fractile"),
                ("leadTimeStdDays", "lead_time_std_days"),
                ("errorMessage", "error_message"),
            ]
            for camel, snake in pairs:
                val = data.get(camel, data.get(snake))
                if val is not None:
                    data[camel] = val
                    data[snake] = val
        return data


class InventoryItemResponse(BaseModel):
    """Inventory item schema representing on-hand stock and warehouse buffer metadata."""
    sku: str
    name: str
    category: str
    warehouse: str
    warehouseLocation: Optional[str] = Field(None, validation_alias=AliasChoices("warehouseLocation", "warehouse_location"), serialization_alias="warehouseLocation")
    warehouse_location: Optional[str] = None
    currentStock: int = Field(..., validation_alias=AliasChoices("currentStock", "current_stock"), serialization_alias="currentStock")
    current_stock: Optional[int] = None
    safetyStock: int = Field(0, validation_alias=AliasChoices("safetyStock", "safety_stock"), serialization_alias="safetyStock")
    safety_stock: Optional[int] = None
    reorderLevel: int = Field(0, validation_alias=AliasChoices("reorderLevel", "reorder_level"), serialization_alias="reorderLevel")
    reorder_level: Optional[int] = None
    reorderQuantity: int = Field(0, validation_alias=AliasChoices("reorderQuantity", "reorder_quantity"), serialization_alias="reorderQuantity")
    reorder_quantity: Optional[int] = None
    unitPrice: float = Field(0.0, validation_alias=AliasChoices("unitPrice", "unit_price"), serialization_alias="unitPrice")
    unit_price: Optional[float] = None
    leadTimeDays: int = Field(7, validation_alias=AliasChoices("leadTimeDays", "lead_time_days"), serialization_alias="leadTimeDays")
    lead_time_days: Optional[int] = None
    dataSource: str = Field(..., validation_alias=AliasChoices("dataSource", "data_source"), serialization_alias="dataSource")
    data_source: Optional[str] = None
    hasHistoricalDemand: bool = Field(False, validation_alias=AliasChoices("hasHistoricalDemand", "has_historical_demand"), serialization_alias="hasHistoricalDemand")
    has_historical_demand: Optional[bool] = None
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_cases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pairs = [
                ("warehouseLocation", "warehouse_location"),
                ("currentStock", "current_stock"),
                ("safetyStock", "safety_stock"),
                ("reorderLevel", "reorder_level"),
                ("reorderQuantity", "reorder_quantity"),
                ("unitPrice", "unit_price"),
                ("leadTimeDays", "lead_time_days"),
                ("dataSource", "data_source"),
                ("hasHistoricalDemand", "has_historical_demand"),
            ]
            for camel, snake in pairs:
                val = data.get(camel, data.get(snake))
                if val is not None:
                    data[camel] = val
                    data[snake] = val
        return data


class DemandHistoryPoint(BaseModel):
    """Individual daily customer demand observation."""
    date: str
    demand: float


class DemandHistoryResponse(BaseModel):
    """Historical demand response with explicit data provenance metadata."""
    sku: str
    productName: str = Field(..., validation_alias=AliasChoices("productName", "product_name"), serialization_alias="productName")
    product_name: Optional[str] = None
    dataSource: str = Field(..., validation_alias=AliasChoices("dataSource", "data_source"), serialization_alias="dataSource")
    data_source: Optional[str] = None
    isSimulated: bool = Field(..., validation_alias=AliasChoices("isSimulated", "is_simulated"), serialization_alias="isSimulated")
    is_simulated: Optional[bool] = None
    totalObservations: int = Field(..., validation_alias=AliasChoices("totalObservations", "total_observations"), serialization_alias="totalObservations")
    total_observations: Optional[int] = None
    storeId: Optional[str] = Field(None, validation_alias=AliasChoices("storeId", "store_id"), serialization_alias="storeId")
    store_id: Optional[str] = None
    historicalData: List[DemandHistoryPoint] = Field(..., validation_alias=AliasChoices("historicalData", "historical_data"), serialization_alias="historicalData")
    historical_data: Optional[List[DemandHistoryPoint]] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_cases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pairs = [
                ("productName", "product_name"),
                ("dataSource", "data_source"),
                ("isSimulated", "is_simulated"),
                ("totalObservations", "total_observations"),
                ("storeId", "store_id"),
                ("historicalData", "historical_data"),
            ]
            for camel, snake in pairs:
                val = data.get(camel, data.get(snake))
                if val is not None:
                    data[camel] = val
                    data[snake] = val
        return data



class ForecastHealthResponse(BaseModel):
    """Health check response for the forecasting engine."""
    status: str
    engine: str
    prophetVersion: str = Field(..., validation_alias=AliasChoices("prophetVersion", "prophet_version"), serialization_alias="prophetVersion")
    prophet_version: Optional[str] = None
    availableAlgorithms: List[str] = Field(..., validation_alias=AliasChoices("availableAlgorithms", "available_algorithms"), serialization_alias="availableAlgorithms")
    available_algorithms: Optional[List[str]] = None
    ready: bool

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    @model_validator(mode="before")
    @classmethod
    def sync_cases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            pv = data.get("prophetVersion", data.get("prophet_version"))
            data["prophetVersion"] = pv
            data["prophet_version"] = pv
            aa = data.get("availableAlgorithms", data.get("available_algorithms"))
            data["availableAlgorithms"] = aa
            data["available_algorithms"] = aa
        return data
