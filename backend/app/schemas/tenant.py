from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TenantCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
