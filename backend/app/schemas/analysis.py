"""
Pydantic schemas for the SynChain AI Analysis Module.
Defines data contracts for Supply Chain Health KPIs, Unified Risk Register,
Shipment Risk, Supplier Risk, Inventory Buffer Risk, Forecast Demand Analysis,
Scenario Simulation, and Actionable Recommendations.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Supply Chain Health KPIs & Overview
# ---------------------------------------------------------------------------

class SupplyChainHealthKPIs(BaseModel):
    total_shipments: int = Field(..., description="Total shipments recorded in the system")
    delayed_shipments: int = Field(..., description="Shipments currently past expected delivery or flagged delayed")
    high_risk_shipments: int = Field(..., description="Shipments with risk score >= 60 (HIGH or CRITICAL)")
    active_suppliers: int = Field(..., description="Active suppliers in the registry")
    products_below_safety_stock: int = Field(..., description="Products whose available inventory is below safety stock")
    products_at_risk_of_stockout: int = Field(..., description="Products with days of inventory <= 5 or critical status")
    total_inventory_items: int = Field(0, description="Total inventory records tracked across warehouses")
    average_supplier_reliability: float = Field(0.0, description="Mean reliability score across active suppliers")
    data_freshness_timestamp: str = Field(..., description="ISO timestamp of when the analysis was generated")


class RiskFindingItem(BaseModel):
    risk_id: str = Field(..., description="Deterministic unique identifier for the risk finding")
    category: str = Field(..., description="Category: Shipment Delay, Supplier Risk, Inventory Shortage, Forecast Variance, Multi-Factor")
    affected_entity_type: str = Field(..., description="Entity type: shipment, supplier, product, warehouse")
    affected_entity_name: str = Field(..., description="Human-readable entity name")
    entity_identifier: str = Field(..., description="Code or SKU (e.g. SHP-1001, SUP-AERO, SKU-INV-001)")
    risk_score: int = Field(..., ge=0, le=100, description="Normalized score 0-100")
    risk_level: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    primary_risk_factors: List[str] = Field(default_factory=list, description="Key driving risk factors")
    potential_business_impact: str = Field(..., description="Quantified or described operational consequence")
    recommended_action: str = Field(..., description="Specific recommended mitigation action")
    analysis_timestamp: str = Field(..., description="ISO timestamp of analysis")
    calculation_details: Optional[Dict[str, Any]] = Field(None, description="Detailed evidence, observed facts, and mathematical components")


class AnalysisOverviewResponse(BaseModel):
    kpis: SupplyChainHealthKPIs
    shipment_risk_distribution: Dict[str, int] = Field(..., description="Counts of shipments by risk level")
    supplier_risk_distribution: Dict[str, int] = Field(..., description="Counts of suppliers by risk level")
    inventory_status_distribution: Dict[str, int] = Field(..., description="Counts of inventory items by status (optimal, warning, critical)")
    risk_distribution_by_category: Dict[str, int] = Field(..., description="Counts of active risks by category")
    top_risks: List[RiskFindingItem] = Field(default_factory=list, description="Top prioritized critical/high risks")
    analysis_timestamp: str = Field(..., description="Current analysis execution timestamp")
    system_status: str = Field("nominal", description="Health status of analysis backend")


# ---------------------------------------------------------------------------
# 2. Unified Risk Register
# ---------------------------------------------------------------------------

class RiskRegisterListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    risks: List[RiskFindingItem]
    available_categories: List[str]
    available_severities: List[str]


class RiskDetailResponse(BaseModel):
    risk: RiskFindingItem
    observed_facts: List[str] = Field(default_factory=list, description="Verifiable ground-truth data points")
    calculated_metrics: Dict[str, Any] = Field(default_factory=dict, description="Deterministic metrics and formulas")
    model_predictions: Optional[Dict[str, Any]] = Field(None, description="ML / heuristic risk projections if applicable")
    potential_consequences: List[str] = Field(default_factory=list, description="Operational and financial risks if unmitigated")
    suggested_actions: List[str] = Field(default_factory=list, description="Actionable mitigation choices")


# ---------------------------------------------------------------------------
# 3. Shipment Risk Analysis
# ---------------------------------------------------------------------------

class ShipmentAnalysisItem(BaseModel):
    id: str
    shipment_id: str
    shipment_name: str
    supplier_name: Optional[str] = None
    supplier_id: Optional[str] = None
    origin: str
    destination: str
    transport_mode: str
    carrier_name: str
    status: str
    delay_days: float = 0.0
    departure_date: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    risk_score: int
    risk_level: str
    risk_factors: List[Dict[str, Any]] = Field(default_factory=list)
    impact: str
    explanation: str


class ShipmentAnalysisListResponse(BaseModel):
    total: int
    delayed_count: int
    high_risk_count: int
    average_delay_days: float
    items: List[ShipmentAnalysisItem]


# ---------------------------------------------------------------------------
# 4. Supplier Risk Analysis
# ---------------------------------------------------------------------------

class SupplierAnalysisItem(BaseModel):
    id: str
    supplier_code: str
    supplier_name: str
    tier: str
    category: str
    location: Optional[str] = None
    country: str
    reliability_score: float
    quality_rate: Optional[float] = None
    on_time_delivery_rate: float
    average_delay_days: float = 0.0
    capacity_utilization: Optional[float] = None
    active_shipments_count: int = 0
    single_source_risk: bool = False
    spend_annual_usd: float = 0.0
    health_status: str
    risk_score: int
    risk_level: str
    key_risk_factors: List[str] = Field(default_factory=list)
    explanation: str
    alternative_sourcing_profile: Optional[Dict[str, Any]] = None


class SupplierAnalysisListResponse(BaseModel):
    total: int
    high_risk_count: int
    single_source_count: int
    average_reliability: float
    items: List[SupplierAnalysisItem]


# ---------------------------------------------------------------------------
# 5. Inventory Risk Analysis
# ---------------------------------------------------------------------------

class InventoryAnalysisItem(BaseModel):
    id: str
    product_id: str
    warehouse_id: str
    sku: str
    name: str
    category: str
    facility: str
    location: Optional[str] = None
    on_hand_units: int
    reserved_units: int
    available_units: int
    safety_stock_units: int
    reorder_point: int
    reorder_quantity: int
    average_daily_demand: Optional[float] = None
    days_of_supply: Optional[float] = None
    buffer_health_percentage: float
    status: str
    risk_score: int
    risk_level: str
    stockout_risk: bool
    estimated_stockout_date: Optional[str] = None
    explanation: str
    evidence: List[str] = Field(default_factory=list)


class InventoryAnalysisListResponse(BaseModel):
    total: int
    below_safety_count: int
    stockout_risk_count: int
    critical_status_count: int
    items: List[InventoryAnalysisItem]


# ---------------------------------------------------------------------------
# 6. Forecast and Stockout Analysis
# ---------------------------------------------------------------------------

class ForecastAnalysisItem(BaseModel):
    sku: str
    product_name: str
    category: str
    warehouse: str
    forecast_horizon_days: int
    expected_total_demand: float
    current_available_inventory: float
    expected_inventory_after_demand: float
    stockout_predicted: bool
    estimated_stockout_day: Optional[int] = None
    estimated_stockout_date: Optional[str] = None
    historical_baseline_daily_avg: Optional[float] = None
    confidence_lower_total: Optional[float] = None
    confidence_upper_total: Optional[float] = None
    model_version: str
    data_source: str
    limitations: List[str] = Field(default_factory=list)


class ForecastAnalysisListResponse(BaseModel):
    total: int
    stockout_predicted_count: int
    items: List[ForecastAnalysisItem]


# ---------------------------------------------------------------------------
# 7. Scenario Simulation
# ---------------------------------------------------------------------------

class AnalysisSimulationRequest(BaseModel):
    current_inventory: float = Field(..., ge=0, description="Current available inventory units")
    daily_demand: float = Field(..., gt=0, description="Expected daily consumption rate")
    shipment_delay_days: int = Field(..., ge=0, description="Delay duration for original shipment in days")
    original_lead_time_days: int = Field(default=7, ge=1, description="Original delivery lead time in days")
    replenishment_quantity: float = Field(default=500.0, gt=0, description="Scheduled batch replenishment size")
    alternative_supplier_lead_time_days: int = Field(default=4, ge=1, description="Lead time for alternative supplier in days")
    alternative_procurement_cost_premium_pct: float = Field(default=15.0, ge=0.0, description="Cost premium percentage for alternative supplier")
    expedite_transit_reduction_days: int = Field(default=3, ge=1, description="Days shaved off delay by expediting")
    expedite_cost_usd: float = Field(default=1200.0, ge=0.0, description="Expedited freight fee in USD")
    unit_stockout_penalty_usd: float = Field(default=50.0, ge=0.0, description="Cost per unmet demand unit")
    unit_cost_usd: float = Field(default=25.0, ge=0.0, description="Base purchase cost per unit")
    product_sku: Optional[str] = Field(None, description="Optional target SKU to pull context")


class DailyTrajectoryPoint(BaseModel):
    day: int
    date: str
    scenario_a_wait_stock: float
    scenario_b_alt_stock: float
    scenario_c_expedite_stock: float


class ScenarioOutcome(BaseModel):
    name: str
    description: str
    replenishment_day: int
    stockout_day: Optional[int] = None
    days_in_stockout: int = 0
    total_unmet_demand: float = 0.0
    stockout_penalty_cost: float = 0.0
    logistics_extra_cost: float = 0.0
    procurement_premium_cost: float = 0.0
    total_financial_impact_usd: float = 0.0
    minimum_inventory_reached: float = 0.0


class AnalysisSimulationResponse(BaseModel):
    product_sku: Optional[str] = None
    parameters: Dict[str, Any]
    trajectories: List[DailyTrajectoryPoint]
    scenario_a_wait: ScenarioOutcome
    scenario_b_alternative: ScenarioOutcome
    scenario_c_expedite: ScenarioOutcome
    comparison_summary: Dict[str, Any]
    advisory_recommendation: str
    assumptions: List[str]


# ---------------------------------------------------------------------------
# 8. Actionable Recommendation Engine
# ---------------------------------------------------------------------------

class AnalysisRecommendationItem(BaseModel):
    recommendation_id: str = Field(..., description="Unique ID for recommendation")
    related_risk_id: Optional[str] = None
    title: str
    category: str  # 'Inventory Replenishment', 'Supplier Engagement', 'Shipment Expediting', 'Buffer Adjustment'
    suggested_action: str
    supporting_evidence: List[str] = Field(default_factory=list)
    expected_benefit: str
    important_trade_offs: str
    required_user_decision: str
    priority: str  # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    status: str = "Open"  # 'Open', 'Reviewed', 'Accepted', 'Rejected', 'Resolved'
    created_at: str
    updated_at: Optional[str] = None


class RecommendationStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="One of: Open, Reviewed, Accepted, Rejected, Resolved")
    notes: Optional[str] = None


class AnalysisRecommendationsListResponse(BaseModel):
    total: int
    open_count: int
    resolved_count: int
    recommendations: List[AnalysisRecommendationItem]
