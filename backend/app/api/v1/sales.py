"""
FastAPI Routes for the SynChain AI Sales Ingestion and Forecasting Module.

Endpoints:
- POST   /api/v1/sales/upload-preview
- POST   /api/v1/sales/import
- GET    /api/v1/sales/transactions
- GET    /api/v1/sales/transactions/{tx_id}
- PUT    /api/v1/sales/transactions/{tx_id}
- DELETE /api/v1/sales/transactions/{tx_id}
- GET    /api/v1/sales/overview
- GET    /api/v1/sales/historical
- GET    /api/v1/sales/forecast
- POST   /api/v1/sales/simulate-scenario
- GET    /api/v1/sales/supply-chain-integration
"""

import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_optional_current_user
from app.models.postgres.models import User
from app.schemas.sales import (
    SalesUploadPreviewResponse,
    SalesImportExecuteRequest,
    SalesImportSummaryResponse,
    SalesTransactionResponse,
    SalesTransactionListResponse,
    SalesTransactionUpdate,
    SalesOverviewKPIs,
    HistoricalSalesAnalysisResponse,
    RevenueForecastResponse,
    SalesScenarioRequest,
    SalesScenarioResponse,
    SalesSupplyChainIntegrationResponse,
)
from app.services.sales.sales_ingestion_service import SalesIngestionService
from app.services.sales.sales_service import SalesAnalyticsService
from app.services.sales.sales_forecasting_service import SalesForecastingService
from app.services.sales.sales_scenario_service import SalesScenarioService
from app.services.sales.sales_integration_service import SalesIntegrationService

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post(
    "/upload-preview",
    response_model=SalesUploadPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload and preview sales CSV with schema auto-mapping and row-level validation",
)
async def upload_sales_preview(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Parses CSV, validates column schema, detects missing fields, invalid formats,
    in-file duplicates, and existing database duplicates. Returns staged preview.
    """
    return await SalesIngestionService.upload_and_preview(
        db=db,
        file=file,
        current_user=current_user,
    )


@router.post(
    "/import",
    response_model=SalesImportSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm and execute atomic import of staged sales transactions into database",
)
def execute_sales_import(
    payload: SalesImportExecuteRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Atomically writes validated staged records to PostgreSQL.
    Rolls back cleanly on any database constraint or transactional failure.
    """
    user_id = current_user.id if current_user else None
    return SalesIngestionService.execute_import(
        db=db,
        import_id=payload.import_id,
        skip_duplicates=payload.skip_duplicates,
        user_id=user_id,
    )


@router.get(
    "/transactions",
    response_model=SalesTransactionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List, search, filter, and paginate imported sales transactions",
)
def list_sales_transactions(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=200, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by transaction ID, product, SKU, customer, or order"),
    product_id: Optional[str] = Query(None, description="Filter by product SKU or ID"),
    category: Optional[str] = Query(None, description="Filter by product category"),
    region: Optional[str] = Query(None, description="Filter by sales region"),
    start_date: Optional[str] = Query(None, description="Earliest date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Latest date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    return SalesIngestionService.list_transactions(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        product_id=product_id,
        category=category,
        region=region,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/transactions/{tx_id}",
    response_model=SalesTransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single sales transaction details",
)
def get_sales_transaction(tx_id: uuid.UUID, db: Session = Depends(get_db)):
    return SalesIngestionService.get_transaction(db=db, tx_id=tx_id)


@router.put(
    "/transactions/{tx_id}",
    response_model=SalesTransactionResponse,
    status_code=status.HTTP_200_OK,
    summary="Correct or update an existing sales transaction",
)
def update_sales_transaction(
    tx_id: uuid.UUID,
    payload: SalesTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    return SalesIngestionService.update_transaction(db=db, tx_id=tx_id, payload=payload)


@router.delete(
    "/transactions/{tx_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a sales transaction",
)
def delete_sales_transaction(
    tx_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    return SalesIngestionService.delete_transaction(db=db, tx_id=tx_id)


@router.get(
    "/overview",
    response_model=SalesOverviewKPIs,
    status_code=status.HTTP_200_OK,
    summary="Get high-level sales KPIs (Revenue, Units, ASP, MoM/YoY growth)",
)
def get_sales_overview_kpis(
    year: Optional[int] = Query(None, description="Filter by calendar year"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    region: Optional[str] = Query(None, description="Filter by region"),
    product_id: Optional[str] = Query(None, description="Filter by product ID or SKU"),
    db: Session = Depends(get_db),
):
    return SalesAnalyticsService.get_overview_kpis(
        db=db,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category=category,
        region=region,
        product_id=product_id,
    )


@router.get(
    "/historical",
    response_model=HistoricalSalesAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive historical sales analysis and trends",
)
def get_historical_sales_analysis(
    year: Optional[int] = Query(None, description="Filter by calendar year"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    region: Optional[str] = Query(None, description="Filter by region"),
    product_id: Optional[str] = Query(None, description="Filter by product ID or SKU"),
    db: Session = Depends(get_db),
):
    return SalesAnalyticsService.get_historical_analysis(
        db=db,
        year=year,
        start_date=start_date,
        end_date=end_date,
        category=category,
        region=region,
        product_id=product_id,
    )


@router.get(
    "/forecast",
    response_model=RevenueForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate statistical revenue and unit forecast with evaluation metrics",
)
def get_revenue_forecast(
    horizon_days: int = Query(30, description="Forecast horizon in days (30, 60, 90, 180, 365)"),
    product_id: Optional[str] = Query(None, description="Filter forecast for specific product SKU/ID"),
    category: Optional[str] = Query(None, description="Filter forecast for specific product category"),
    evaluate: bool = Query(True, description="Run chronological 80/20 out-of-sample evaluation"),
    db: Session = Depends(get_db),
):
    return SalesForecastingService.generate_sales_forecast(
        db=db,
        horizon_days=horizon_days,
        product_id=product_id,
        category=category,
        evaluate=evaluate,
    )


@router.post(
    "/simulate-scenario",
    response_model=SalesScenarioResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate sales scenarios with volume, price elasticity, and fulfillment caps",
)
def simulate_sales_scenario(
    payload: SalesScenarioRequest,
    db: Session = Depends(get_db),
):
    return SalesScenarioService.simulate_scenario(db=db, request=payload)


@router.get(
    "/supply-chain-integration",
    response_model=SalesSupplyChainIntegrationResponse,
    status_code=status.HTTP_200_OK,
    summary="Link sales demand projections to inventory buffers and incoming shipments",
)
def get_sales_supply_chain_integration(
    db: Session = Depends(get_db),
):
    return SalesIntegrationService.evaluate_supply_chain_integration(db=db)
