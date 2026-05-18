"""Per-(tenant, user) chat history, persisted to Postgres.

Was an in-memory dict during the v0 spike; replaced with DB-backed storage
so messages survive backend restarts and we can later run analytics on
historical conversations (which intents people use, which actions get
cancelled, etc.).

The public dataclasses (`ChatMessage`, `PendingAction`) are intentionally
preserved unchanged — they're the contract the SSE endpoint and the
response schema both depend on. The functions are now thin adapters over
SQLAlchemy: load → row, map row → dataclass, hand back.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.chat import ChatAction as ChatActionRow
from app.models.chat import ChatMessage as ChatMessageRow
from app.services.intent_parser import ParsedIntent


Role = Literal["user", "assistant"]
ActionStatus = Literal["pending", "confirmed", "cancelled", "executed", "expired"]


@dataclass
class PendingAction:
    id: str
    kind: str
    summary: str
    risk_tier: str
    params: dict[str, Any]
    requires_confirmation: bool
    status: ActionStatus = "pending"
    receipt: dict[str, Any] | None = None
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass
class ChatMessage:
    id: str
    role: Role
    content: str
    created_at: str
    action: PendingAction | None = None
    intent_kind: str | None = None
    confidence: float | None = None


# ---------- adapters ----------


def _row_to_action(row: ChatActionRow | None) -> PendingAction | None:
    if row is None:
        return None
    return PendingAction(
        id=str(row.id),
        kind=row.kind,
        summary=row.summary,
        risk_tier=row.risk_tier,
        params=dict(row.params or {}),
        requires_confirmation=row.requires_confirmation,
        status=row.status,  # type: ignore[arg-type]
        receipt=dict(row.receipt) if row.receipt else None,
        created_at=row.created_at.isoformat(),
    )


def _row_to_message(row: ChatMessageRow) -> ChatMessage:
    return ChatMessage(
        id=str(row.id),
        role=row.role,  # type: ignore[arg-type]
        content=row.content,
        created_at=row.created_at.isoformat(),
        action=_row_to_action(row.action),
        intent_kind=row.intent_kind,
        confidence=row.confidence,
    )


# ---------- queries ----------


def list_messages(db: Session, tenant_id: UUID, user_id: UUID) -> list[ChatMessage]:
    rows = db.scalars(
        select(ChatMessageRow)
        .where(ChatMessageRow.tenant_id == tenant_id, ChatMessageRow.user_id == user_id)
        .order_by(ChatMessageRow.created_at)
    ).all()
    return [_row_to_message(r) for r in rows]


def reset(db: Session, tenant_id: UUID, user_id: UUID) -> None:
    """Drop every message + action belonging to this (tenant, user).

    Two-step because messages reference actions via SET NULL on delete —
    deleting messages first is safe; deleting actions first would orphan
    the FK pointer in any persisted messages.
    """
    db.execute(
        delete(ChatMessageRow).where(
            ChatMessageRow.tenant_id == tenant_id,
            ChatMessageRow.user_id == user_id,
        )
    )
    db.execute(
        delete(ChatActionRow).where(
            ChatActionRow.tenant_id == tenant_id,
            ChatActionRow.user_id == user_id,
        )
    )
    db.commit()


def append_user_message(
    db: Session, tenant_id: UUID, user_id: UUID, text: str
) -> ChatMessage:
    row = ChatMessageRow(
        id=uuid4(),
        tenant_id=tenant_id,
        user_id=user_id,
        role="user",
        content=text,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_message(row)


def append_assistant_reply(
    db: Session, tenant_id: UUID, user_id: UUID, intent: ParsedIntent
) -> ChatMessage:
    action_row: ChatActionRow | None = None
    if intent.requires_confirmation:
        action_row = ChatActionRow(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            kind=intent.kind,
            summary=intent.summary,
            risk_tier=intent.risk_tier,
            params=dict(intent.params),
            requires_confirmation=True,
            status="pending",
        )
        db.add(action_row)
        db.flush()  # populate id before message references it

    message_row = ChatMessageRow(
        id=uuid4(),
        tenant_id=tenant_id,
        user_id=user_id,
        role="assistant",
        content=intent.assistant_reply,
        intent_kind=intent.kind,
        confidence=intent.confidence,
        action_id=action_row.id if action_row else None,
    )
    db.add(message_row)
    db.commit()
    db.refresh(message_row)
    return _row_to_message(message_row)


def get_action(
    db: Session, tenant_id: UUID, user_id: UUID, action_id: str
) -> PendingAction | None:
    """Tenant + user scoping in the query itself — a foreign session can't
    fetch someone else's action even with its raw UUID."""
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        return None
    row = db.scalar(
        select(ChatActionRow).where(
            ChatActionRow.id == action_uuid,
            ChatActionRow.tenant_id == tenant_id,
            ChatActionRow.user_id == user_id,
        )
    )
    return _row_to_action(row)


def update_action(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
    action_id: str,
    *,
    status: ActionStatus,
    receipt: dict[str, Any] | None = None,
) -> PendingAction | None:
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        return None
    row = db.scalar(
        select(ChatActionRow).where(
            ChatActionRow.id == action_uuid,
            ChatActionRow.tenant_id == tenant_id,
            ChatActionRow.user_id == user_id,
        )
    )
    if row is None:
        return None
    row.status = status
    if receipt is not None:
        row.receipt = receipt
    db.commit()
    db.refresh(row)
    return _row_to_action(row)


def message_to_dict(message: ChatMessage) -> dict[str, Any]:
    return asdict(message)
