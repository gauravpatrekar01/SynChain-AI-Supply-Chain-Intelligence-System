from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_active_user
from app.api.v1.ingestion import import_user
from app.services import operations

router = APIRouter(prefix="/operations", tags=["operations"], dependencies=[Depends(get_current_active_user)])

@router.get("/snapshot")
def snapshot(db: Session = Depends(get_db)):
    return operations.snapshot(db)

class ForecastRequest(BaseModel):
    sku: str
    horizon: int = Field(30, ge=1, le=180)

@router.post("/forecast", dependencies=[Depends(import_user)])
def forecast(payload: ForecastRequest, db: Session = Depends(get_db)):
    return operations.forecast_product(db, payload.sku, payload.horizon)

class ScenarioRequest(BaseModel):
    inventory_id: UUID
    days: int = Field(30, ge=1, le=180)
    demand_change_pct: float = Field(0, ge=-100, le=1000)

@router.post("/simulate")
def simulate(payload: ScenarioRequest, db: Session = Depends(get_db)):
    return operations.simulate(db, str(payload.inventory_id), payload.days, payload.demand_change_pct)
