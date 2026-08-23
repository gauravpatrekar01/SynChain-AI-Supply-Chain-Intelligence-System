from datetime import datetime
from typing import Optional
import uuid

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


SYSTEM_TYPES = {"ERP", "WMS", "CRM", "Custom API"}


class IntegrationCredentials(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    system_type: str
    base_url: AnyHttpUrl
    api_key: str = Field(..., min_length=1)
    api_secret: Optional[str] = None
    api_version: Optional[str] = Field(default=None, max_length=100)


class IntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    system_type: str
    base_url: str
    api_version: Optional[str] = None
    is_active: bool
    last_tested_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str