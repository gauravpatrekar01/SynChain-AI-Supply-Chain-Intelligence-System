from datetime import datetime
from typing import Optional, Dict, Any, Literal
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