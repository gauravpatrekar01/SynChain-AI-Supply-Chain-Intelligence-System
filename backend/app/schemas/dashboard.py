from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field


class DashboardHealthComponent(BaseModel):
    key: str
    label: str
    score: Optional[float] = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=1)
    sampleSize: int = Field(ge=0)


class DashboardOverviewResponse(BaseModel):
    overallHealthScore: Optional[float] = Field(ge=0, le=100)
    healthComponents: List[DashboardHealthComponent]
    healthDataStatus: Literal["available", "insufficient_data"]
    healthExplanation: str
    globalRiskIndex: int
    activeDisruptions: int
    onTimeDeliveryRate: float
    totalInventoryValueUsd: float
    supplierHealthScore: float
    totalRecordsIngested: int
    productsCount: int
    suppliersCount: int
    warehousesCount: int
    inventoryUnitsTotal: int
    ordersCount: int
    activeIntegrationsHealthy: int
    lastUpdated: str


class DashboardTrendsResponse(BaseModel):
    ingestionTrend: List[Dict[str, Any]]
    inventoryVelocity: List[Dict[str, Any]]
    demandForecast: List[Dict[str, Any]]
    riskSeverityDistribution: Dict[str, int]


class DashboardRiskItem(BaseModel):
    id: str
    entityType: str
    entityId: str
    entityName: str
    tier: Optional[str] = None
    country: Optional[str] = None
    riskScore: int
    severity: str
    category: str
    explanation: str
    contributingFactors: List[Dict[str, Any]]
    confidenceScore: float
    downstreamImpact: Optional[Dict[str, Any]] = None
    singleSourceRisk: Optional[bool] = None
    createdAt: str


class DashboardAlertItem(BaseModel):
    id: str
    title: str
    severity: str
    category: str
    source: str
    impactSummary: str
    timestamp: str
    details: Optional[Dict[str, Any]] = None


class DashboardRecommendationItem(BaseModel):
    id: str
    action: str
    reason: str
    expectedBenefit: Optional[str] = None
    estimatedCost: Optional[float] = None
    confidence: float
    affectedEntities: Optional[List[str]] = None
    createdAt: str


class ScenarioSimulateRequest(BaseModel):
    scenarioName: str = Field(default="Custom Disruption Scenario")
    disruptionType: str = Field(default="weather_event")
    targetEntityId: Optional[str] = Field(default="hub-1")
    targetEntityName: Optional[str] = Field(default="Memphis SuperHub")
    durationDays: int = Field(default=14, ge=1, le=180)
    severityPct: int = Field(default=50, ge=1, le=100)
    includeSecondTierCascade: bool = Field(default=True)
    autoMitigate: bool = Field(default=True)
