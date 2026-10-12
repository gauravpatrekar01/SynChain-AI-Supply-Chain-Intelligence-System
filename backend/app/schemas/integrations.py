from datetime import datetime
from typing import Optional, Dict, Any, Literal, List
import uuid

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


SYSTEM_TYPES = {"ERPNext", "Generic REST", "SAP S/4HANA Cloud", "Oracle NetSuite ERP"}
AUTH_TYPES = {"api_key", "bearer", "basic", "none"}


class IntegrationCredentials(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    system_type: str
    base_url: str
    auth_type: str = "api_key"
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    api_version: Optional[str] = Field(default=None, max_length=100)
    configuration: Optional[Dict[str, Any]] = None


class IntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    system_type: str
    base_url: str
    auth_type: str
    api_version: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    status: str
    is_active: bool
    last_tested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str


class IntegrationHealthItem(BaseModel):
    name: str
    category: str
    configuration_status: Literal["configured", "not_configured"]
    connection_status: Literal["healthy", "degraded", "unhealthy", "unknown"]
    last_checked_at: Optional[datetime] = None
    last_successful_check_at: Optional[datetime] = None
    response_time_ms: float
    last_sync_at: Optional[datetime] = None
    error_category: Optional[str] = None
    error_message: Optional[str] = None
    is_enabled: bool = True
    data_freshness: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class AllIntegrationsHealthResponse(BaseModel):
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    healthy_count: int
    degraded_count: int
    unhealthy_count: int
    not_configured_count: int
    total_count: int
    timestamp: datetime
    integrations: List[IntegrationHealthItem]


class HealthCheckTriggerRequest(BaseModel):
    integration_name: Optional[str] = None


class IntegrationHealthDetailResponse(BaseModel):
    integration: IntegrationHealthItem
    history: List[Dict[str, Any]]
