from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


RiskTier = str  # "low" | "medium" | "high"


def record_event(
    db: Session,
    *,
    tenant_id: UUID,
    actor_user_id: UUID | None,
    event_type: str,
    summary: str,
    risk_tier: RiskTier = "low",
    details: dict[str, Any] | None = None,
    prompt_text: str | None = None,
) -> AuditEvent:
    """Append-only write. Caller is responsible for the surrounding transaction."""
    event = AuditEvent(
        id=uuid4(),
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        risk_tier=risk_tier,
        summary=summary,
        prompt_text=prompt_text,
        details=details or {},
    )
    db.add(event)
    return event
