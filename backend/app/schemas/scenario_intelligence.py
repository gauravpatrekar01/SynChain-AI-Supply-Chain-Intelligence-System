"""
Pydantic schemas for the SynChain Scenario Intelligence & Evidence Reports.

Covers:
- Scenario Simulation Request with objectives and operational constraints
- 4 Multi-Strategy Simulation Outputs (Switch, Split, Expedite, Accept)
- Daily Trajectory Points for granular time-series charts
- AI-generated explanation schema and verified fallback schema
- Calculation transparency and data provenance schemas
- Simulation Evidence Report schemas (summary, detail, persistence)
- Data readiness assessment schema
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data Readiness Schema
# ---------------------------------------------------------------------------

class DataReadinessCheck(BaseModel):
    is_ready: bool
    status: Literal["ready", "partial", "not_ready"]
    total_products: int
    total_suppliers: int
    total_warehouses: int
    total_inventory_records: int
    total_shipments: int
    data_freshness_timestamp: Optional[str] = None
    readiness_score_pct: float
    missing_elements: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ScenarioConfigOption(BaseModel):
    value: str
    label: str
    category: Optional[str] = None
    lead_time_days: Optional[int] = None
    reliability_score: Optional[float] = None
    country: Optional[str] = None
    unit_cost_usd: Optional[float] = None
    stock_on_hand: Optional[int] = None
    daily_demand: Optional[float] = None
    safety_stock: Optional[int] = None
    source_supplier_id: Optional[str] = None
    source_supplier_name: Optional[str] = None
    source_warehouse_name: Optional[str] = None
    source_address: Optional[str] = None
    destination_warehouse_name: Optional[str] = None
    destination_address: Optional[str] = None
    carrier_name: Optional[str] = None
    transport_mode: Optional[str] = None
    shipment_id: Optional[str] = None
    shipment_status: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    import_id: Optional[str] = None
    organization_ids: Optional[List[str]] = None
    has_alternative_supplier: Optional[bool] = None


class ProductStrategyEligibility(BaseModel):
    strategy_id: str
    strategy_name: str
    is_eligible: bool
    reason: str
    prerequisites: Optional[str] = None


class ProductRecommendationSummary(BaseModel):
    sku: str
    product_name: str
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    is_data_complete: bool = True
    missing_fields: List[str] = Field(default_factory=list)
    eligible_strategies: List[ProductStrategyEligibility] = Field(default_factory=list)
    active_recommendations: List[Dict[str, Any]] = Field(default_factory=list)
    next_required_action: str


class ScenarioConfigOptionsResponse(BaseModel):
    organizations: List[Dict[str, Any]] = Field(default_factory=list)
    products: List[ScenarioConfigOption]
    suppliers: List[ScenarioConfigOption]
    warehouses: List[ScenarioConfigOption]
    disruption_types: List[Dict[str, str]]
    objectives: List[Dict[str, str]]


# ---------------------------------------------------------------------------
# Scenario Simulation Request
# ---------------------------------------------------------------------------

class ScenarioSimulationRequest(BaseModel):
    scenario_name: str = Field(..., min_length=2, max_length=255, description="Human-readable scenario title")
    disruption_type: Literal[
        "supplier_outage",
        "port_closure",
        "freight_delay",
        "demand_surge",
        "raw_material_spike",
        "geopolitical_embargo",
    ] = Field(default="supplier_outage", description="Type of disruption")
    
    # Target entities (verified from DB or configured)
    target_product_id: Optional[str] = Field(default=None, description="Target product / SKU identifier")
    sku: Optional[str] = Field(default="P0001", description="SKU code (e.g. P0001, SYN-TEST-101, IC-3NM-A18)")
    target_supplier_id: Optional[str] = Field(default=None, description="Primary supplier identifier")
    target_supplier_name: Optional[str] = Field(default="Primary Supplier", description="Primary supplier display name")
    target_warehouse_id: Optional[str] = Field(default=None, description="Receiving warehouse identifier")
    
    # Disruption parameters
    duration_days: int = Field(default=14, ge=1, le=180, description="Duration of the disruption in days")
    severity_pct: int = Field(default=70, ge=1, le=100, description="Severity percentage (1-100)")
    disruption_delay_days: Optional[int] = Field(default=None, ge=0, le=120, description="Direct delay added to lead time")
    
    # Inventory & Demand parameters
    simulation_horizon_days: int = Field(default=30, ge=7, le=180, description="Simulation horizon in days")
    initial_inventory: Optional[int] = Field(default=None, ge=0, description="On-hand inventory units at day 0")
    order_quantity: Optional[int] = Field(default=None, gt=0, description="Replenishment order quantity")
    safety_stock: Optional[int] = Field(default=None, ge=0, description="Safety stock threshold")
    daily_demand: Optional[float] = Field(default=None, ge=0, description="Average daily demand")
    use_forecast_demand: bool = Field(default=False, description="Whether to query the forecasting engine for demand series")
    
    # Optimization Objective & Operational Constraints
    objective: Literal[
        "minimize_cost",
        "minimize_delay",
        "maximize_service_level",
        "balanced"
    ] = Field(default="balanced", description="Decision optimization goal")
    budget_limit_usd: Optional[float] = Field(default=None, ge=0, description="Maximum mitigation expenditure cap")
    max_acceptable_delay_days: Optional[int] = Field(default=None, ge=0, description="Maximum acceptable delay in days")
    
    # Alternate Supplier for Mitigation Evaluation
    alternative_supplier_id: Optional[str] = Field(default=None, description="Alternative supplier identifier")
    alternative_supplier_name: Optional[str] = Field(default=None, description="Alternative supplier display name")
    alternative_lead_time_days: Optional[int] = Field(default=None, ge=1, description="Alternative supplier lead time")
    alternative_unit_cost_usd: Optional[float] = Field(default=None, ge=0, description="Alternative supplier unit cost")

    # Organization & Route Context
    organization_id: Optional[str] = Field(default=None, description="Selected organization / division identifier")
    organization_name: Optional[str] = Field(default=None, description="Selected organization display name")
    source_warehouse_name: Optional[str] = Field(default=None, description="Source warehouse name")
    source_address: Optional[str] = Field(default=None, description="Source address or location")
    destination_warehouse_name: Optional[str] = Field(default=None, description="Destination warehouse or facility")
    destination_address: Optional[str] = Field(default=None, description="Destination address or location")
    carrier_name: Optional[str] = Field(default=None, description="Carrier name")
    transport_mode: Optional[str] = Field(default=None, description="Transport mode")


# ---------------------------------------------------------------------------
# Trajectory & Mitigation Strategy Schemas
# ---------------------------------------------------------------------------

class DailyTrajectoryPoint(BaseModel):
    day: int = Field(..., description="Day index (1-based)")
    starting_inventory: int = Field(..., description="Inventory at start of day")
    incoming_quantity: int = Field(..., description="Replenishment quantity received on this day")
    demand: float = Field(..., description="Customer demand on this day")
    fulfilled_demand: float = Field(..., description="Demand fulfilled from available stock")
    unmet_demand: float = Field(..., description="Unmet demand (stockout)")
    ending_inventory: int = Field(..., description="Inventory at end of day")
    cumulative_unmet_demand: float = Field(..., description="Cumulative unmet demand")
    is_safety_stock_breached: bool = Field(..., description="Whether ending inventory is below safety threshold")
    is_stockout: bool = Field(..., description="Whether unmet demand occurred")


class MitigationStrategyResult(BaseModel):
    strategy_id: Literal[
        "SWITCH_SUPPLIER",
        "SPLIT_PROCUREMENT",
        "EXPEDITE_AIR_FREIGHT",
        "ACCEPT_RISK"
    ] = Field(..., description="Unique strategy identifier")
    strategy_name: str = Field(..., description="Display title of strategy")
    strategy_type: str = Field(..., description="Category: supplier_switch | dual_sourcing | rush_logistics | risk_absorption")
    description: str = Field(..., description="Operational summary of the strategy")
    operational_action: str = Field(..., description="Actionable execution steps for logistics/procurement")
    
    # Key performance indicators
    arrival_day: int = Field(..., description="Day replenishment arrives at destination")
    delivery_delay_days: int = Field(..., description="Net delivery delay compared to normal baseline")
    service_level_pct: float = Field(..., description="Demand fulfillment service level percentage (0-100)")
    stockout_days_count: int = Field(..., description="Total days on which a stockout occurred")
    unmet_demand_units: float = Field(..., description="Total unmet customer demand units")
    
    # Cost breakdown
    direct_purchase_cost_usd: float = Field(..., description="Order purchase cost")
    logistics_expedite_cost_usd: float = Field(..., description="Expediting, freight, or switching overhead")
    holding_cost_usd: float = Field(..., description="Inventory carrying cost")
    stockout_penalty_cost_usd: float = Field(..., description="Stockout penalty cost")
    total_cost_usd: float = Field(..., description="Total scenario cost (sum of all cost components)")
    
    # Scoring & Feasibility
    feasibility_status: Literal[
        "FEASIBLE",
        "FEASIBLE_WITH_TRADE_OFFS",
        "CONSTRAINED_BY_BUDGET",
        "CONSTRAINED_BY_CAPACITY"
    ] = Field(default="FEASIBLE")
    objective_score: float = Field(..., description="Normalized 0-100 score relative to selected objective")
    rank: int = Field(..., description="Ranking (1 is best for selected objective)")
    trade_offs: List[str] = Field(default_factory=list, description="Explicit operational trade-offs")
    daily_trajectory: List[DailyTrajectoryPoint] = Field(default_factory=list)


class BaselineAndDisruptedSummary(BaseModel):
    scenario_type: Literal["baseline", "disrupted"]
    display_name: str
    arrival_day: int
    delivery_delay_days: int
    service_level_pct: float
    stockout_days_count: int
    unmet_demand_units: float
    total_cost_usd: float
    direct_purchase_cost_usd: float
    logistics_expedite_cost_usd: float
    holding_cost_usd: float
    stockout_penalty_cost_usd: float
    daily_trajectory: List[DailyTrajectoryPoint] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Calculation Transparency & Evidence Provenance Schemas
# ---------------------------------------------------------------------------

class MetricCalculationDetail(BaseModel):
    metric_name: str
    definition: str
    formula: str
    input_values: Dict[str, Any]
    result_value: float
    units: str
    assumptions: str
    data_source: str


class DataProvenance(BaseModel):
    source_name: str
    dataset_identifier: str
    records_count: int
    data_freshness_timestamp: str
    is_live_database: bool
    data_limitations: List[str] = Field(default_factory=list)


class AffectedEntitySummary(BaseModel):
    suppliers: List[Dict[str, Any]] = Field(default_factory=list)
    products: List[Dict[str, Any]] = Field(default_factory=list)
    warehouses: List[Dict[str, Any]] = Field(default_factory=list)
    shipments: List[Dict[str, Any]] = Field(default_factory=list)


class AINarrative(BaseModel):
    executive_summary: str
    operational_impact_summary: str
    recommended_response_explanation: str
    trade_off_analysis: str
    confidence_limitations: str
    is_ai_generated: bool
    model_used: Optional[str] = None
    fallback_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Top-Level Simulation Response & Report Schemas
# ---------------------------------------------------------------------------

class ScenarioSimulationResponse(BaseModel):
    report_id: str
    scenario_id: Optional[str] = None
    scenario_name: str
    disruption_type: str
    objective: str
    created_at: str
    
    # Core simulation outputs
    baseline: BaselineAndDisruptedSummary
    disrupted: BaselineAndDisruptedSummary
    mitigation_strategies: List[MitigationStrategyResult]
    recommended_strategy_id: str
    recommended_strategy_name: str
    recommendation_rationale: str
    
    # Explainability & Evidence
    organization_name: Optional[str] = "Global Supply Chain Enterprise"
    route_details: Optional[Dict[str, Any]] = None
    affected_entities: AffectedEntitySummary
    calculation_transparency: Dict[str, MetricCalculationDetail]
    data_provenance: DataProvenance
    ai_narrative: AINarrative
    
    # Model and environment metadata
    model_version: str = "SynChain-Sim-v2.1"
    disclaimer: str = (
        "This report represents a deterministic multi-echelon supply chain simulation based on specified "
        "historical inputs and mathematical assumptions. It is decision-support advisory intelligence, "
        "not a guarantee that simulated future disruptions will unfold identically in physical operations."
    )


class SimulationEvidenceReportSummary(BaseModel):
    report_id: str
    scenario_name: str
    disruption_type: str
    objective: str
    recommended_strategy_id: str
    recommended_strategy_name: str
    baseline_cost_usd: float
    disrupted_cost_usd: float
    mitigated_cost_usd: float
    service_level_saved_pct: float
    created_at: str
    is_ai_generated: bool
