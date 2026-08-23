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
)
from app.core.security import encrypt_secret

router = APIRouter(prefix="/integrations", tags=["integrations"])


def validate_system_type(system_type: str) -> None:
    if system_type not in SYSTEM_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported system type")


async def test_credentials(credentials: IntegrationCredentials) -> bool:
    headers = {"X-API-Key": credentials.api_key}
    if credentials.api_secret:
        headers["X-API-Secret"] = credentials.api_secret
    url = str(credentials.base_url).rstrip("/")
    if credentials.api_version:
        url = f"{url}/{credentials.api_version.strip('/')}"
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.get(url, headers=headers)
        return response.is_success
    except (httpx.HTTPError, ValueError):
        return False


@router.post("/test", response_model=ConnectionTestResponse)
async def test_integration(credentials: IntegrationCredentials, current_user: User = Depends(get_current_active_user)):
    validate_system_type(credentials.system_type)
    success = await test_credentials(credentials)
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
        encrypted_api_key=encrypt_secret(credentials.api_key),
        encrypted_api_secret=encrypt_secret(credentials.api_secret) if credentials.api_secret else None,
        last_tested_at=datetime.now(timezone.utc),
    )
    db.add(integration)
    current_user.onboarding_completed = True
    db.commit()
    db.refresh(integration)
    return integration


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