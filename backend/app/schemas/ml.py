from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ShipmentPredictionRequest(BaseModel):
    supplier_location: str = Field(..., description="Location/City of the supplier")
    component_type: str = Field(..., description="Type of component being shipped")
    transport_mode: str = Field("Road", description="Transport mode: Road, Air, Sea, Rail")
    distance_km: float = Field(450.0, ge=0.0, description="Transit distance in kilometers")
    weather_condition: str = Field("Rain", description="Weather condition along corridor")
    seasonal_rainy_period: int = Field(1, ge=0, le=1, description="1 if during monsoon/rainy season, else 0")
    traffic_level: str = Field("High", description="Traffic density: Low, Medium, High")
    supplier_risk_rating: str = Field("Medium", description="Risk rating: Low, Medium, High")
    supplier_on_time_rate: float = Field(0.82, ge=0.0, le=1.0, description="Historical on-time rate [0.0 - 1.0]")
    supplier_quality_rate: float = Field(0.91, ge=0.0, le=1.0, description="Quality acceptance rate [0.0 - 1.0]")
    supplier_capacity_utilization: float = Field(0.85, ge=0.0, le=1.0, description="Current capacity utilization [0.0 - 1.0]")
    order_quantity: int = Field(500, gt=0, description="Batch order quantity in units")
    inventory_at_order: int = Field(200, ge=0, description="Current on-hand inventory units at order placement")
    planned_lead_time_days: int = Field(5, gt=0, description="Planned transit and dispatch lead time in days")
    unit_cost: float = Field(250.0, ge=0.0, description="Unit cost in USD")


class ShipmentPredictionResponse(BaseModel):
    delay_probability: float
    delay_probability_percent: float
    risk_level: str
    model_type: str
    data_source: str
    production_ready: bool


class SupplierRecommendationRequest(BaseModel):
    component_type: str = Field(..., description="Component type required")
    order_quantity: int = Field(..., gt=0, description="Order quantity required")
    supplier_location: Optional[str] = "Pune"
    transport_mode: Optional[str] = "Road"
    distance_km: Optional[float] = 450.0
    weather_condition: Optional[str] = "Rain"
    seasonal_rainy_period: Optional[int] = 1
    traffic_level: Optional[str] = "High"
    inventory_at_order: Optional[int] = 200
    planned_lead_time_days: Optional[int] = 5
    unit_cost: Optional[float] = 250.0
    max_results: int = Field(5, ge=1, le=50, description="Maximum number of recommendations to return")


class SupplierRecommendationItem(BaseModel):
    supplier_id: str
    supplier_name: str
    location: str
    component_type: str
    estimated_delay_probability: float
    estimated_delay_percent: float
    average_lead_time_days: float
    quality_rate: float
    unit_cost_index: float
    available_capacity_units: int
    on_time_delivery_rate: float
    recommendation_score: Optional[float] = None
    prediction_source: str


class SupplierRecommendationResponse(BaseModel):
    recommendations: List[SupplierRecommendationItem]
    total_eligible: int
    component_type: str
    order_quantity: int


class InventorySimulationRequest(BaseModel):
    initial_inventory: int = Field(300, ge=0, description="Starting buffer inventory units")
    daily_demand: int = Field(100, gt=0, description="Daily factory consumption units")
    simulation_days: int = Field(30, ge=1, le=180, description="Simulation horizon in days")
    shipment_quantity: int = Field(1000, gt=0, description="Order replenishment batch size")
    component_type: Optional[str] = Field("Battery", description="Component type for supplier selection")


class InventorySimulationResponse(BaseModel):
    summary: Dict[str, Any]
    daily_records_count: int
    daily_records_sample: List[Dict[str, Any]]
    selected_supplier: Optional[Dict[str, Any]] = None
    replenishment_settings: Optional[Dict[str, Any]] = None


class DecisionReportRequest(BaseModel):
    initial_inventory: Optional[int] = 300
    daily_demand: Optional[int] = 100
    simulation_days: Optional[int] = 30
    shipment_quantity: Optional[int] = 1000
    component_type: Optional[str] = "Battery"


class DecisionReportResponse(BaseModel):
    summaries: Dict[str, Any]
    selected_supplier: Dict[str, Any]
    findings: Dict[str, Any]
    report_text: str
    report_path: Optional[str] = None


class MLHealthResponse(BaseModel):
    model_loaded: bool
    model_path: str
    model_type: str
    expected_features: List[str]
    features_count: int
    reference_data_status: Dict[str, bool]
    status: str
    test_inference_latency_ms: Optional[float] = None
    message: Optional[str] = None
