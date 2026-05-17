from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_tenant_membership
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.schemas.audit import AuditEventListResponse, AuditEventResponse


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditEventListResponse)
def list_audit_events(
    tenant_id: UUID = Depends(require_tenant_membership),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: str | None = Query(None, description="Substring match on event_type"),
) -> AuditEventListResponse:
    base = select(AuditEvent).where(AuditEvent.tenant_id == tenant_id)
    count_base = select(func.count()).select_from(AuditEvent).where(AuditEvent.tenant_id == tenant_id)

    if event_type:
        base = base.where(AuditEvent.event_type.ilike(f"%{event_type}%"))
        count_base = count_base.where(AuditEvent.event_type.ilike(f"%{event_type}%"))

    total = db.scalar(count_base) or 0
    rows = list(
        db.scalars(
            base.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )

    return AuditEventListResponse(
        items=[AuditEventResponse.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
