from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class AuditEventResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    actor_user_id: UUID | None
    event_type: str
    risk_tier: str
    summary: str
    details: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEventListResponse(BaseModel):
    items: list[AuditEventResponse]
    total: int
    limit: int
    offset: int
