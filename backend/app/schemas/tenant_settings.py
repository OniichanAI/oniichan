from datetime import datetime
from typing import Literal

from pydantic import BaseModel


RiskTier = Literal["low", "medium", "high"]


class TenantSettingsResponse(BaseModel):
    execution_enabled: bool
    autonomy_enabled: bool
    max_risk_tier: RiskTier
    kill_switch_active: bool
    bootstrap_completed: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class TenantSettingsUpdate(BaseModel):
    execution_enabled: bool | None = None
    autonomy_enabled: bool | None = None
    max_risk_tier: RiskTier | None = None
    kill_switch_active: bool | None = None
    bootstrap_completed: bool | None = None
