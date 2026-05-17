from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant_settings import TenantSettings


def get_or_create(db: Session, tenant_id: UUID) -> TenantSettings:
    settings = db.scalar(select(TenantSettings).where(TenantSettings.tenant_id == tenant_id))
    if settings is None:
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


_RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


def allows_risk(settings: TenantSettings, risk_tier: str) -> bool:
    """True if `risk_tier` falls within the tenant's allowed cap."""
    if settings.kill_switch_active:
        return False
    if not settings.execution_enabled:
        return False
    return _RISK_ORDER.get(risk_tier, 99) <= _RISK_ORDER.get(settings.max_risk_tier, 0)
