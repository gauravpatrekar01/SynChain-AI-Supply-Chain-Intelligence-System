"""
Pydantic schemas for the Supply Chain Decision Simulator.
Defines input parameters for baseline, disrupted, and alternative supplier
scenarios, daily inventory trajectories, and explainable advisory decisions.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class DecisionSimulationRequest(BaseModel):
    """Scenario simulation configuration inputs."""
    sku: str = Field(..., description="Product/SKU identifier (e.g. P0001, SYN-TEST-101, IC-3NM-A18)")
    initialInventory: int = Field(..., ge=0, description="Current on-hand inventory units")
    dailyDemand: Optional[float] = Field(default=None, ge=0, description="Average daily demand rate")
    dailyDemandSeries: Optional[List[float]] = Field(default=None, description="Explicit daily demand values per day")
    useForecastDemand: bool = Field(default=False, description="Whether to query the forecasting engine for daily demand")
    simulationDays: int = Field(default=30, ge=1, le=180, description="Simulation horizon in days")
    orderQuantity: int = Field(default=500, gt=0, description="Replenishment order quantity")
    orderDay: int = Field(default=1, ge=1, description="Day on which the replenishment order is placed")
    safetyStock: int = Field(default=100, ge=0, description="Safety stock threshold for breach detection")
    # Primary Supplier
    primarySupplierId: Optional[str] = Field(default=None, description="Primary supplier identifier")
    primarySupplierName: str = Field(default="Primary Supplier", description="Primary supplier display name")
    primaryLeadTimeDays: int = Field(default=5, ge=1, description="Baseline lead time in days")
    # Disruption Parameters
    disruptionDelayDays: int = Field(default=7, ge=0, description="Additional delay days caused by disruption")
    disruptionType: Optional[str] = Field(default="supplier_outage", description="Type of disruption scenario")
    # Alternative Supplier (optional)
    alternativeSupplierId: Optional[str] = Field(default=None, description="Alternative supplier identifier")
    alternativeSupplierName: Optional[str] = Field(default=None, description="Alternative supplier display name")
    alternativeLeadTimeDays: Optional[int] = Field(default=None, ge=1, description="Alternative supplier lead time in days")
    alternativeCapacity: Optional[int] = Field(default=None, ge=0, description="Alternative supplier capacity limit in units")
    # Cost & Capacity parameters (optional, verified or explicitly assumed)
    unitCostBaseline: Optional[float] = Field(default=None, ge=0, description="Unit purchasing cost with primary supplier")
    unitCostAlternative: Optional[float] = Field(default=None, ge=0, description="Unit purchasing cost with alternative supplier")
    holdingCostPerUnitDay: Optional[float] = Field(default=None, ge=0, description="Inventory holding cost per unit per day")
    stockoutPenaltyPerUnit: Optional[float] = Field(default=None, ge=0, description="Stockout penalty cost per unmet unit")
    # Data Provenance tag
    dataProvenance: Optional[str] = Field(default=None, description="Data provenance label (postgresql_live, retail_dataset_actual, deterministic_demo, user_custom)")
class DailyTrajectoryPoint(BaseModel):
    """Daily state of inventory, orders, demand fulfillment, and breach tracking."""
    day: int = Field(..., description="Day index (1-based)")
    startingInventory: int = Field(..., description="Inventory at start of day")
    incomingQuantity: int = Field(..., description="Quantity received on this day")
    demand: float = Field(..., description="Customer demand on this day")
    fulfilledDemand: float = Field(..., description="Demand fulfilled from available stock")
    unmetDemand: float = Field(..., description="Demand that could not be fulfilled (stockout)")
    endingInventory: int = Field(..., description="Inventory at end of day")
    cumulativeUnmetDemand: float = Field(..., description="Cumulative unmet demand through this day")
    isSafetyStockBreached: bool = Field(..., description="Whether ending inventory is below safety stock")
    isStockout: bool = Field(..., description="Whether unmet demand occurred on this day")


class ScenarioSummary(BaseModel):
    """Aggregated outcome metrics for a single scenario."""
    endingInventory: int = Field(..., description="Inventory remaining at end of simulation horizon")
    totalDemand: float = Field(..., description="Total demand across simulation horizon")
    totalFulfilledDemand: float = Field(..., description="Total demand successfully fulfilled")
    totalUnmetDemand: float = Field(..., description="Total unmet demand (lost sales / backlog)")
    serviceLevelPct: float = Field(..., description="Fulfilled demand percentage of total demand")
    stockoutDaysCount: int = Field(..., description="Total days on which a stockout occurred")
    firstStockoutDay: Optional[int] = Field(default=None, description="First day on which stockout occurred")
    safetyStockBreachDaysCount: int = Field(..., description="Days on which inventory breached safety stock")
    firstSafetyStockBreachDay: Optional[int] = Field(default=None, description="First day safety stock was breached")
    supplierArrivalDay: int = Field(..., description="Day replenishment order arrived at warehouse")
    estimatedPurchaseCostUsd: Optional[float] = Field(default=None, description="Estimated order purchasing cost")
    estimatedHoldingCostUsd: Optional[float] = Field(default=None, description="Estimated inventory holding cost")
    estimatedStockoutPenaltyUsd: Optional[float] = Field(default=None, description="Estimated stockout penalty cost")
    estimatedTotalCostUsd: Optional[float] = Field(default=None, description="Total estimated scenario cost")


class ScenarioDetail(BaseModel):
    """Full detail of a scenario including trajectory and summary."""
    scenarioName: str = Field(..., description="Display name of scenario")
    scenarioType: Literal["baseline", "disrupted", "alternative"] = Field(..., description="Scenario classification")
    supplierName: str = Field(..., description="Supplier supplying the replenishment order")
    leadTimeDays: int = Field(..., description="Effective supplier lead time in days")
    arrivalDay: int = Field(..., description="Expected arrival day")
    dailyTrajectory: List[DailyTrajectoryPoint] = Field(..., description="Daily inventory trajectory")
    summary: ScenarioSummary = Field(..., description="Summary metrics")


class ScenarioComparison(BaseModel):
    """Direct comparative delta between baseline, disrupted, and alternative scenarios."""
    hasAlternativeScenario: bool = Field(..., description="Whether alternative scenario was evaluated")
    daysSavedByAlternative: Optional[int] = Field(default=None, description="Days earlier alternative supplier arrives vs disrupted")
    unmetDemandPreventedByAlternative: Optional[float] = Field(default=None, description="Unmet demand saved by alternative")
    stockoutPrevented: Optional[bool] = Field(default=None, description="Whether alternative completely prevented stockout")
    costDifferenceUsd: Optional[float] = Field(default=None, description="Cost difference: alternative minus disrupted (if cost data available)")
    costComparisonStatus: str = Field(..., description="Status of cost comparison (e.g. verified, incomplete, not_supplied)")


class DecisionAdvice(BaseModel):
    """Explainable decision guidance and recommendations."""
    recommendedAction: Literal[
        "SWITCH_TO_ALTERNATIVE",
        "MAINTAIN_PRIMARY",
        "EXPEDITE_AND_CONSERVE",
        "INSUFFICIENT_ALTERNATIVE_DATA",
        "BUFFER_ABSORBS_DELAY"
    ] = Field(..., description="Coded recommendation action")
    recommendationTitle: str = Field(..., description="Human-readable title")
    explanation: str = Field(..., description="Detailed rationale explaining the recommendation")
    keyFactors: List[str] = Field(..., description="Key decision factors influencing this recommendation")
    advisoryDisclaimer: str = Field(
        default="Advisory only. SynChain AI does not execute automatic purchasing, contract changes, or inventory movements.",
        description="Legal and operational advisory notice"
    )


class DecisionSimulationResponse(BaseModel):
    """Complete simulation result comparing baseline, disrupted, and alternative options."""
    scenarioId: str = Field(..., description="Unique scenario execution identifier")
    sku: str = Field(..., description="Product SKU simulated")
    simulatedAt: str = Field(..., description="ISO timestamp of simulation run")
    simulationHorizonDays: int = Field(..., description="Number of days simulated")
    dataProvenance: str = Field(..., description="Data provenance label")
    demandSource: str = Field(..., description="Source of demand data used in simulation")
    demandType: str = Field(..., description="constant or daily_varying")
    dailyDemandRate: float = Field(..., description="Average daily demand rate applied")
    
    # Scenarios
    scenarios: Dict[str, ScenarioDetail] = Field(..., description="baseline, disrupted, and optional alternative scenarios")
    
    # Comparative Evaluation & Decision
    comparison: ScenarioComparison = Field(..., description="Direct comparative deltas")
    decision: DecisionAdvice = Field(..., description="Actionable recommendation and rationale")
    
    # Explicit Assumptions and Limitations
    assumptions: List[str] = Field(..., description="Explicit modeling assumptions")
    limitations: List[str] = Field(..., description="Known data limitations and disclosures")
class SupplierSummary(BaseModel):
    """Supplier entity for simulation selection dropdowns."""
    supplier_id: str
    supplier_name: str
    location: str
    average_lead_time_days: int
    reliability_score: float
    available_capacity_units: Optional[int] = None
    unit_cost_index: Optional[float] = None
    component_types: List[str] = []
    is_active: bool = True
    data_provenance: str = "supplier_master_dataset"


class SupplierListResponse(BaseModel):
    """List of available suppliers for scenario simulation."""
    total: int
    suppliers: List[SupplierSummary]
