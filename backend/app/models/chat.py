"""Chat persistence: messages + per-message pending actions.

Scoped by (tenant_id, user_id) — each owner of a tenant has their own
conversation, and tenants never share state. Messages are append-only;
actions mutate over their lifetime (pending → confirmed/cancelled/executed).
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ChatAction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "chat_actions"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(10), nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(
        Enum(
            "pending", "confirmed", "cancelled", "executed", "expired",
            name="chat_action_status",
        ),
        nullable=False, default="pending",
    )
    receipt: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    message = relationship("ChatMessage", back_populates="action", uselist=False)


class ChatMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        Enum("user", "assistant", name="chat_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    intent_kind: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    action_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("chat_actions.id", ondelete="SET NULL"),
        nullable=True,
    )

    action = relationship("ChatAction", back_populates="message")
