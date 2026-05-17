from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatSendRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class PendingActionResponse(BaseModel):
    id: str
    kind: str
    summary: str
    risk_tier: str
    params: dict[str, Any]
    requires_confirmation: bool
    status: Literal["pending", "confirmed", "cancelled", "executed", "expired"]
    receipt: dict[str, Any] | None
    created_at: str


class ChatMessageResponse(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
    action: PendingActionResponse | None = None
    intent_kind: str | None = None
    confidence: float | None = None


class ChatSendResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]


class ActionResolutionResponse(BaseModel):
    action: PendingActionResponse
    receipt_text: str
