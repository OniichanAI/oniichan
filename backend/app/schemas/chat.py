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

# ==============================================================================
# DIRECT ACTION SCHEMAS
# ==============================================================================

class DirectMessageRequest(BaseModel):
    channel_id: str = Field(..., min_length=1, description="The Discord channel ID target")
    text: str = Field(..., min_length=1, max_length=2000, description="The message content to be sent")


class DirectActionResponse(BaseModel):
    ok: bool = Field(..., description="Indicates if the direct action was successful")
    message: str = Field(..., description="A brief status message describing the outcome")
    details: dict[str, Any] | None = Field(None, description="Native payload details returned from the Discord API")

class BulkDeleteRequest(BaseModel):
    message_ids: list[str] = Field(
        ..., 
        min_size=1, 
        max_size=100, 
        description="A list of Discord message IDs to be deleted simultaneously (Max 100)"
    )


class EditMessageRequest(BaseModel):
    text: str = Field(
        ..., 
        min_length=1, 
        max_length=2000, 
        description="The new text content to update the message with"
    )