from datetime import datetime, timezone
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.postgres.models import EnterpriseIntegration, User
from app.schemas.integrations import (
    ConnectionTestResponse,
    IntegrationCredentials,
    IntegrationResponse,
    SYSTEM_TYPES,
    AllIntegrationsHealthResponse,
    HealthCheckTriggerRequest,
    IntegrationHealthDetailResponse,
    IntegrationHealthItem,
)
from app.core.security import encrypt_secret
from app.integrations import get_adapter
from app.services.integration_service import IntegrationService
from app.services.health.integration_health_service import IntegrationHealthService

router = APIRouter(prefix="/integrations", tags=["integrations"])


def validate_system_type(system_type: str) -> None:
    if system_type not in SYSTEM_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported system type")


@router.get("/health", response_model=AllIntegrationsHealthResponse)
async def get_all_integrations_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns the latest recorded health status of all known integrations."""
    items = await IntegrationHealthService.check_all_integrations(db, persist=True)
    healthy_c = sum(1 for i in items if i["connection_status"] == "healthy")
    degraded_c = sum(1 for i in items if i["connection_status"] == "degraded")
    unhealthy_c = sum(1 for i in items if i["connection_status"] == "unhealthy")
    not_conf_c = sum(1 for i in items if i["configuration_status"] == "not_configured")
    overall = "healthy" if unhealthy_c == 0 and degraded_c == 0 else ("degraded" if unhealthy_c == 0 else "unhealthy")

    return AllIntegrationsHealthResponse(
        overall_status=overall,
        healthy_count=healthy_c,
        degraded_count=degraded_c,
        unhealthy_count=unhealthy_c,
        not_configured_count=not_conf_c,
        total_count=len(items),
        timestamp=datetime.now(timezone.utc),
        integrations=[IntegrationHealthItem(**item) for item in items],
    )


@router.post("/health/check", response_model=AllIntegrationsHealthResponse)
async def trigger_health_checks(
    request: HealthCheckTriggerRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Runs health checks for configured integrations, optionally filtered by integration name."""
    req_name = request.integration_name if request else None
    if req_name:
        single_item = await IntegrationHealthService.check_single_integration(db, req_name, persist=True)
        if not single_item:
            raise HTTPException(status_code=404, detail=f"Integration '{req_name}' not found")
        items = [single_item]
    else:
        items = await IntegrationHealthService.check_all_integrations(db, persist=True)

    healthy_c = sum(1 for i in items if i["connection_status"] == "healthy")
    degraded_c = sum(1 for i in items if i["connection_status"] == "degraded")
    unhealthy_c = sum(1 for i in items if i["connection_status"] == "unhealthy")
    not_conf_c = sum(1 for i in items if i["configuration_status"] == "not_configured")
    overall = "healthy" if unhealthy_c == 0 and degraded_c == 0 else ("degraded" if unhealthy_c == 0 else "unhealthy")

    return AllIntegrationsHealthResponse(
        overall_status=overall,
        healthy_count=healthy_c,
        degraded_count=degraded_c,
        unhealthy_count=unhealthy_c,
        not_configured_count=not_conf_c,
        total_count=len(items),
        timestamp=datetime.now(timezone.utc),
        integrations=[IntegrationHealthItem(**item) for item in items],
    )


@router.get("/health/{integration_name}", response_model=IntegrationHealthDetailResponse)
async def get_integration_health_detail(
    integration_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns detailed health and recent check history for one integration."""
    check_result = await IntegrationHealthService.check_single_integration(db, integration_name, persist=True)
    if not check_result:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_name}' not found")
    
    history = IntegrationHealthService.get_integration_history(db, check_result["name"], limit=20)
    return IntegrationHealthDetailResponse(
        integration=IntegrationHealthItem(**check_result),
        history=history,
    )


@router.post("/test", response_model=ConnectionTestResponse)
async def test_integration(credentials: IntegrationCredentials, current_user: User = Depends(get_current_active_user)):
    validate_system_type(credentials.system_type)
    
    adapter_cls = get_adapter(credentials.system_type)
    adapter = adapter_cls(
        base_url=credentials.base_url,
        auth_type=credentials.auth_type,
        api_key=credentials.api_key,
        api_secret=credentials.api_secret,
        configuration=credentials.configuration
    )
    
    success = await adapter.test_connection()
    return ConnectionTestResponse(
        success=success,
        message="Connection successful." if success else "Connection failed. Please check your API URL and credentials.",
    )


@router.post("", response_model=IntegrationResponse, status_code=status.HTTP_201_CREATED)
async def create_integration(
    credentials: IntegrationCredentials,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    validate_system_type(credentials.system_type)
    integration = EnterpriseIntegration(
        user_id=current_user.id,
        name=credentials.name,
        system_type=credentials.system_type,
        base_url=str(credentials.base_url),
        api_version=credentials.api_version,
        auth_type=credentials.auth_type,
        encrypted_api_key=encrypt_secret(credentials.api_key) if credentials.api_key else None,
        encrypted_api_secret=encrypt_secret(credentials.api_secret) if credentials.api_secret else None,
        configuration=credentials.configuration,
        status="disconnected",
        last_tested_at=None,
    )
    db.add(integration)
    current_user.onboarding_completed = True
    db.commit()
    db.refresh(integration)
    return integration


@router.post("/{integration_id}/sync", response_model=dict)
async def sync_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    integration = db.query(EnterpriseIntegration).filter(
        EnterpriseIntegration.id == integration_id,
        EnterpriseIntegration.user_id == current_user.id,
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    try:
        results = await IntegrationService.sync_integration(db, integration)
        return {"success": True, "message": "Synchronization completed", "results": results}
    except Exception as e:
        integration.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/skip", response_model=dict)
async def skip_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    current_user.onboarding_completed = True
    db.commit()
    return {"onboarding_completed": True}


@router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return db.query(EnterpriseIntegration).filter(EnterpriseIntegration.user_id == current_user.id).all()


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    integration = db.query(EnterpriseIntegration).filter(
        EnterpriseIntegration.id == integration_id,
        EnterpriseIntegration.user_id == current_user.id,
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    db.delete(integration)
    db.commit()