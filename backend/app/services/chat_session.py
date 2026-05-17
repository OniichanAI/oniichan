"""In-memory chat session store, scoped per (tenant_id, user_id).

This is intentionally non-persistent for v0 — chats reset on backend restart.
When ChatOps moves to LLM-backed streaming, this should become a Redis-backed
store keyed by a session id.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from threading import RLock
from typing import Any, Literal
from uuid import UUID, uuid4

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


@dataclass
class _Session:
    messages: list[ChatMessage] = field(default_factory=list)
    actions: dict[str, PendingAction] = field(default_factory=dict)


_lock = RLock()
_sessions: dict[tuple[str, str], _Session] = {}


def _key(tenant_id: UUID, user_id: UUID) -> tuple[str, str]:
    return (str(tenant_id), str(user_id))


def _get_session(tenant_id: UUID, user_id: UUID) -> _Session:
    key = _key(tenant_id, user_id)
    session = _sessions.get(key)
    if session is None:
        session = _Session()
        _sessions[key] = session
    return session


def list_messages(tenant_id: UUID, user_id: UUID) -> list[ChatMessage]:
    with _lock:
        return list(_get_session(tenant_id, user_id).messages)


def reset(tenant_id: UUID, user_id: UUID) -> None:
    with _lock:
        _sessions.pop(_key(tenant_id, user_id), None)


def append_user_message(tenant_id: UUID, user_id: UUID, text: str) -> ChatMessage:
    with _lock:
        session = _get_session(tenant_id, user_id)
        message = ChatMessage(
            id=str(uuid4()),
            role="user",
            content=text,
            created_at=datetime.now(UTC).isoformat(),
        )
        session.messages.append(message)
        return message


def append_assistant_reply(
    tenant_id: UUID,
    user_id: UUID,
    intent: ParsedIntent,
) -> ChatMessage:
    with _lock:
        session = _get_session(tenant_id, user_id)
        action: PendingAction | None = None
        if intent.requires_confirmation:
            action = PendingAction(
                id=str(uuid4()),
                kind=intent.kind,
                summary=intent.summary,
                risk_tier=intent.risk_tier,
                params=dict(intent.params),
                requires_confirmation=True,
            )
            session.actions[action.id] = action

        message = ChatMessage(
            id=str(uuid4()),
            role="assistant",
            content=intent.assistant_reply,
            created_at=datetime.now(UTC).isoformat(),
            action=action,
            intent_kind=intent.kind,
            confidence=intent.confidence,
        )
        session.messages.append(message)
        return message


def get_action(tenant_id: UUID, user_id: UUID, action_id: str) -> PendingAction | None:
    with _lock:
        return _get_session(tenant_id, user_id).actions.get(action_id)


def update_action(
    tenant_id: UUID,
    user_id: UUID,
    action_id: str,
    *,
    status: ActionStatus,
    receipt: dict[str, Any] | None = None,
) -> PendingAction | None:
    with _lock:
        session = _get_session(tenant_id, user_id)
        action = session.actions.get(action_id)
        if action is None:
            return None
        action.status = status
        if receipt is not None:
            action.receipt = receipt
        return action


def message_to_dict(message: ChatMessage) -> dict[str, Any]:
    return asdict(message)
