from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import require_tenant_membership
from app.db.session import get_db
from app.models.discord import DiscordGuild
from app.models.user import User
from app.schemas.chat import (
    ActionResolutionResponse,
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatSendRequest,
    ChatSendResponse,
    PendingActionResponse,
    DirectActionResponse,
    DirectMessageRequest,
    EditMessageRequest,
    BulkDeleteRequest,
    ChannelMessageFetchResponse,
    ChannelLockRequest,
)
from app.services import chat_session, discord_api, discord_executor, intent_parser
from app.services import tenant_settings as tenant_settings_service
from app.services.audit import record_event


router = APIRouter(prefix="/chat", tags=["chat"])


def _to_message_response(message: chat_session.ChatMessage) -> ChatMessageResponse:
    action_resp = None
    if message.action is not None:
        action_resp = PendingActionResponse(
            id=message.action.id,
            kind=message.action.kind,
            summary=message.action.summary,
            risk_tier=message.action.risk_tier,
            params=message.action.params,
            requires_confirmation=message.action.requires_confirmation,
            status=message.action.status,
            receipt=message.action.receipt,
            created_at=message.action.created_at,
        )
    return ChatMessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        created_at=message.created_at,
        action=action_resp,
        intent_kind=message.intent_kind,
        confidence=message.confidence,
    )


@router.get("/messages", response_model=ChatHistoryResponse)
def list_messages(
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
) -> ChatHistoryResponse:
    return ChatHistoryResponse(
        messages=[_to_message_response(m) for m in chat_session.list_messages(tenant_id, user.id)]
    )


@router.post("/messages", response_model=ChatSendResponse)
def send_message(
    payload: ChatSendRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
) -> ChatSendResponse:
    intent = intent_parser.parse(payload.text)
    user_msg = chat_session.append_user_message(tenant_id, user.id, payload.text)
    assistant_msg = chat_session.append_assistant_reply(tenant_id, user.id, intent)
    return ChatSendResponse(
        user_message=_to_message_response(user_msg),
        assistant_message=_to_message_response(assistant_msg),
    )


@router.post("/messages/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_session(
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
) -> None:
    chat_session.reset(tenant_id, user.id)


async def _resolve_target_channel(db: Session, tenant_id: UUID) -> tuple[str | None, str | None]:
    """Returns (channel_id, error). Uses the guild's system channel as the default target."""
    guild_row = db.scalar(select(DiscordGuild).where(DiscordGuild.tenant_id == tenant_id))
    if guild_row is None:
        return None, "No Discord guild linked to this tenant"
    info = await discord_api.get_guild(guild_row.discord_guild_id)
    if not info:
        return None, "Could not reach Discord (check DISCORD_BOT_TOKEN and bot membership)"
    channel_id = info.get("system_channel_id")
    if not channel_id:
        return None, "This server has no system channel set — pick one in Discord → Server Settings → Overview"
    return channel_id, None


async def _execute(
    db: Session,
    tenant_id: UUID,
    action: chat_session.PendingAction,
) -> dict:
    """Returns the receipt dict to store on the action."""
    channel_id, channel_err = await _resolve_target_channel(db, tenant_id)
    if channel_err:
        return {"mode": "live", "ok": False, "note": channel_err}

    if action.kind == "slowmode":
        result = await discord_executor.set_channel_slowmode(
            channel_id=channel_id, seconds=int(action.params.get("seconds", 0))
        )
    elif action.kind == "announce":
        result = await discord_executor.post_announcement(
            channel_id=channel_id, content=str(action.params.get("text", ""))
        )
    else:
        return {"mode": "live", "ok": False, "note": f"No executor for kind={action.kind}"}

    return {
        "mode": "live",
        "ok": result.ok,
        "status_code": result.status_code,
        "note": result.message,
        "details": result.details,
    }


@router.post("/actions/{action_id}/confirm", response_model=ActionResolutionResponse)
async def confirm_action(
    action_id: str,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActionResolutionResponse:
    action = chat_session.get_action(tenant_id, user.id, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail=f"Action already {action.status}")

    settings = tenant_settings_service.get_or_create(db, tenant_id)
    allowed = tenant_settings_service.allows_risk(settings, action.risk_tier)

    if not allowed:
        reason = (
            "Kill switch is active"
            if settings.kill_switch_active
            else "Execution is disabled in tenant settings"
            if not settings.execution_enabled
            else f"Risk tier '{action.risk_tier}' exceeds tenant cap '{settings.max_risk_tier}'"
        )
        receipt = {
            "mode": "dry-run",
            "ok": True,
            "note": f"Recorded only — {reason}. Enable execution in Settings to run for real.",
        }
        event_summary = f"[dry-run] {action.summary}"
    else:
        receipt = await _execute(db, tenant_id, action)
        event_summary = (
            f"[live] {action.summary}"
            if receipt.get("ok")
            else f"[live-failed] {action.summary}"
        )

    chat_session.update_action(tenant_id, user.id, action_id, status="executed", receipt=receipt)

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type=f"chat.action.{action.kind}",
        summary=event_summary,
        risk_tier=action.risk_tier,
        details={
            "params": action.params,
            "chat_action_id": action.id,
            "receipt": receipt,
        },
    )
    db.commit()

    updated = chat_session.get_action(tenant_id, user.id, action_id)
    assert updated is not None
    return ActionResolutionResponse(
        action=PendingActionResponse(
            id=updated.id,
            kind=updated.kind,
            summary=updated.summary,
            risk_tier=updated.risk_tier,
            params=updated.params,
            requires_confirmation=updated.requires_confirmation,
            status=updated.status,
            receipt=updated.receipt,
            created_at=updated.created_at,
        ),
        receipt_text=str((updated.receipt or {}).get("note") or "Recorded."),
    )


@router.post("/actions/{action_id}/cancel", response_model=ActionResolutionResponse)
def cancel_action(
    action_id: str,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
) -> ActionResolutionResponse:
    action = chat_session.get_action(tenant_id, user.id, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail=f"Action already {action.status}")

    chat_session.update_action(tenant_id, user.id, action_id, status="cancelled")
    updated = chat_session.get_action(tenant_id, user.id, action_id)
    assert updated is not None
    return ActionResolutionResponse(
        action=PendingActionResponse(
            id=updated.id,
            kind=updated.kind,
            summary=updated.summary,
            risk_tier=updated.risk_tier,
            params=updated.params,
            requires_confirmation=updated.requires_confirmation,
            status=updated.status,
            receipt=updated.receipt,
            created_at=updated.created_at,
        ),
        receipt_text=f"Cancelled: {updated.summary}",
    )


# ==============================================================================
# DIRECT MESSAGE MANIPULATION ENDPOINTS (BYPASSING THE AI AGENT)
# ==============================================================================

@router.post("/direct-message", response_model=DirectActionResponse, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    payload: DirectMessageRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """
    Instantly sends a plain text message to a specific Discord channel.
    
    This endpoint bypasses the AI agent and the pending actions queue, acting 
    as an immediate dashboard override. It enforces multi-tenant access control, 
    triggers the Discord API executor, and logs a 'low' risk event to the audit trail.
    """
    result = await discord_executor.send_message(
        channel_id=payload.channel_id, 
        content=payload.text
    )
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type="chat.direct_message.sent",
        summary=f"Direct message sent to channel {payload.channel_id}",
        risk_tier="low",
        details={
            "channel_id": payload.channel_id,
            "text": payload.text,
            "discord_response": result.details
        },
    )
    db.commit()

    return DirectActionResponse(
        ok=True, 
        message="Message sent successfully",
        details=result.details
    )

@router.put("/channels/{channel_id}/messages/{message_id}", response_model=DirectActionResponse, status_code=status.HTTP_200_OK)
async def edit_direct_message(
    channel_id: str,
    message_id: str,
    payload: EditMessageRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """
    Updates the content of an existing message previously sent by the bot.
    
    Allows administrators to correct announcements or text directly from the web panel. 
    It enforces multi-tenant access controls and logs a 'low' risk event to the audit trail.
    """
    result = await discord_executor.edit_message(
        channel_id=channel_id, 
        message_id=message_id,
        content=payload.text
    )
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type="chat.direct_message.updated",
        summary=f"Message {message_id} updated in channel {channel_id}",
        risk_tier="low",
        details={
            "channel_id": channel_id,
            "message_id": message_id,
            "new_text": payload.text,
            "discord_response": result.details
        },
    )
    db.commit()

    return DirectActionResponse(
        ok=True, 
        message="Message updated successfully",
        details=result.details
    )

@router.delete("/channels/{channel_id}/messages/{message_id}", response_model=DirectActionResponse, status_code=status.HTTP_200_OK)
async def delete_direct_message(
    channel_id: str,
    message_id: str,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """
    Immediately deletes a specific message from a given Discord channel.
    
    Designed for fast dashboard-driven content moderation. It authenticates the 
    user against the current tenant, instructs the bot to delete the message via 
    the Discord API, and records a 'medium' risk event in the database for tracking.
    """
    result = await discord_executor.delete_message(
        channel_id=channel_id, 
        message_id=message_id
    )
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type="chat.direct_message.deleted",
        summary=f"Message {message_id} deleted from channel {channel_id}",
        risk_tier="medium",
        details={
            "channel_id": channel_id,
            "message_id": message_id,
            "discord_response": result.details
        },
    )
    db.commit()

    return DirectActionResponse(
        ok=True, 
        message="Message deleted successfully",
        details=result.details
    )


@router.post("/channels/{channel_id}/messages/bulk-delete", response_model=DirectActionResponse, status_code=status.HTTP_200_OK)
async def bulk_delete_messages(
    channel_id: str,
    payload: BulkDeleteRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """
    Deletes multiple messages simultaneously from a given Discord channel.
    
    This endpoint allows fast dashboard moderation during spam attacks. It enforces 
    multi-tenant safety boundaries and records a 'high' risk event in the audit trail.
    """
    result = await discord_executor.bulk_delete_messages(
        channel_id=channel_id, 
        message_ids=payload.message_ids
    )
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type="chat.direct_message.bulk_deleted",
        summary=f"Bulk deleted {len(payload.message_ids)} messages from channel {channel_id}",
        risk_tier="high",
        details={
            "channel_id": channel_id,
            "message_ids": payload.message_ids,
            "discord_response": result.details
        },
    )
    db.commit()

    return DirectActionResponse(
        ok=True, 
        message=f"Successfully deleted {len(payload.message_ids)} messages",
        details=result.details
    )

# ==============================================================================
# ADVANCED MODERATION ENDPOINTS
# ==============================================================================

@router.get("/channels/{channel_id}/messages", response_model=list[ChannelMessageFetchResponse], status_code=status.HTTP_200_OK)
async def fetch_channel_messages(
    channel_id: str,
    limit: int = 50,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
) -> list[ChannelMessageFetchResponse]:
    """
    Fetches the latest messages from a specific Discord channel to render in the UI.
    
    This query does not alter state, so it records no audit event but guarantees 
    the requesting user belongs to the current tenant before retrieving the logs.
    """
    result = await discord_executor.get_messages(channel_id=channel_id, limit=limit)
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )
        
    return result.data


@router.post("/channels/{channel_id}/lock", response_model=DirectActionResponse, status_code=status.HTTP_200_OK)
async def lock_channel(
    channel_id: str,
    payload: ChannelLockRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """
    Locks down a channel by overriding permissions to prevent standard users from speaking.
    
    A critical emergency moderation tool used during raids. It requires a mandatory reason, 
    restricts actions per tenant scope, and generates a 'high' risk audit log entry.
    """
    result = await discord_executor.lock_channel(
        channel_id=channel_id, 
        reason=payload.reason
    )
    
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Discord error: {result.message}"
        )

    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user.id,
        event_type="chat.channel.locked",
        summary=f"Channel {channel_id} lockdown triggered. Reason: {payload.reason}",
        risk_tier="high",
        details={
            "channel_id": channel_id,
            "reason": payload.reason,
            "discord_response": result.details
        },
    )
    db.commit()

    return DirectActionResponse(
        ok=True, 
        message="Channel successfully locked down",
        details=result.details
    )