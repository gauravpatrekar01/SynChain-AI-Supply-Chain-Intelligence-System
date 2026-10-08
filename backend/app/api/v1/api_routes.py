from fastapi import APIRouter, HTTPException, Depends
from app.api.v1.test_email import router as test_email_router
from typing import Dict, Any, List
from pydantic import BaseModel
import uuid

# Import our implemented services
from app.services.forecasting.prophet_forecast import ForecastingService
from app.services.risk_prediction.xgb_predictor import RiskPredictionService
from app.services.graph.neo4j_service import Neo4jGraphService
from app.services.simulation.simulator import SimulationService
from app.services.copilot.ai_service import AICopilotService
from app.api.v1.auth import router as auth_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.ingestion import router as ingestion_router

router = APIRouter()
router.include_router(test_email_router, prefix="/test", tags=["test"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(integrations_router)
router.include_router(ingestion_router)

# Initialize services
forecast_service = ForecastingService()
risk_service = RiskPredictionService()
graph_service = Neo4jGraphService()
sim_service = SimulationService()
copilot_service = AICopilotService()

# --- Pydantic Models for Requests ---
class ForecastRequest(BaseModel):
    productId: str
    historicalData: List[Dict[str, Any]]
    horizonDays: int = 30

class SimulationRequest(BaseModel):
    scenarioName: str
    disruptionType: str
    targetEntityId: str
    targetEntityName: str
    durationDays: int
    severityPct: int
    includeSecondTierCascade: bool = True
    autoMitigate: bool = True

class CopilotRequest(BaseModel):
    message: str
    context: Dict[str, Any]

# --- Routes ---

@router.get("/dashboard/kpis")
async def get_dashboard_kpis():
    """Mock KPI data for the dashboard."""
    return {
        "globalRiskIndex": 42,
        "activeDisruptions": 3,
        "onTimeDeliveryRate": 94.5,
        "totalInventoryValueUsd": 125000000,
        "supplierHealthScore": 88
    }

@router.get("/digital-twin")
async def get_digital_twin_topology():
    """Returns the digital twin topology (nodes and edges)."""
    # In a real scenario, this would query Neo4j for the full graph
    # For now, returning mock data compatible with the frontend
    nodes = [
        {"id": "node-1", "type": "warehouse", "label": "Memphis Hub", "status": "nominal", "riskScore": 12, "coordinates": [35.1495, -90.0490], "location": "Memphis, TN"},
        {"id": "node-2", "type": "supplier", "label": "TechCorp Asia", "status": "warning", "riskScore": 65, "coordinates": [22.5431, 114.0579], "location": "Shenzhen, China"},
        {"id": "node-3", "type": "manufacturer", "label": "Giga Assembly", "status": "nominal", "riskScore": 25, "coordinates": [30.2241, -97.6169], "location": "Austin, TX"},
    ]
    edges = [
        {"id": "edge-1", "source": "node-2", "target": "node-3", "type": "transport", "status": "delayed", "transportMode": "ocean", "estimatedTransitDays": 24},
        {"id": "edge-2", "source": "node-3", "target": "node-1", "type": "transport", "status": "nominal", "transportMode": "rail", "estimatedTransitDays": 4},
    ]
    return {"nodes": nodes, "edges": edges}

@router.post("/forecast")
async def generate_forecast(request: ForecastRequest):
    try:
        # Generate forecast using Prophet
        forecast_result = forecast_service.generate_demand_forecast(
            historical_data=request.historicalData,
            horizon=request.horizonDays
        )
        return forecast_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/risk/{entity_type}/{entity_id}")
async def get_entity_risk(entity_type: str, entity_id: str):
    """Get risk prediction for a specific entity."""
    try:
        # In a real app, we would fetch the entity's features from the DB here
        mock_features = {'demand_volatility': 0.6, 'supplier_lead_time': 0.9, 'inventory_level': 0.15}
        
        # Predict risk
        risk_result = risk_service.predict_risk(mock_features)
        
        # Get downstream impact using Neo4j
        impact = graph_service.get_downstream_impact(entity_id)
        
        return {
            "entityId": entity_id,
            "entityType": entity_type,
            "riskAssessment": risk_result,
            "downstreamImpact": impact
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scenarios/simulate")
async def run_simulation(request: SimulationRequest):
    try:
        # Run Monte Carlo Simulation
        simulation_result = sim_service.run_monte_carlo_simulation(request.model_dump())
        return simulation_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/copilot/chat")
async def chat_with_copilot(request: CopilotRequest):
    try:
        response_text = copilot_service.generate_response(
            user_message=request.message,
            context=request.context
        )
        return {
            "id": f"msg-{uuid.uuid4().hex[:8]}",
            "text": response_text,
            "sender": "ai",
            "timestamp": "2026-08-22 19:30:00 UTC",
            "actionRequired": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
