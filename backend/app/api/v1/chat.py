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
