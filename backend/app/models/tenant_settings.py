from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TenantSettings(TimestampMixin, Base):
    __tablename__ = "tenant_settings"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Master switch — if false, ChatOps confirms stay in dry-run mode.
    execution_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Autonomy is forward-looking: when true, the AI can confirm its own
    # actions without human approval, subject to the risk caps below.
    autonomy_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Highest risk tier we're willing to execute: "low" | "medium" | "high".
    # In v0 this guards both human-confirmed and (future) autonomous flows.
    max_risk_tier: Mapped[str] = mapped_column(String(10), nullable=False, default="low")

    # Hard stop — when true, no execution regardless of other settings.
    kill_switch_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Flipped true the first time an owner walks through the welcome wizard.
    # Used by the frontend to route brand-new tenants to /welcome on entry.
    bootstrap_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
