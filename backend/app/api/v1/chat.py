import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import require_tenant_membership
from app.db.session import get_db
from app.models.discord import DiscordGuild
from app.models.user import User
from app.schemas.chat import (
    ActionResolutionResponse,
    BulkDeleteRequest,
    ChannelLockRequest,
    ChannelMessageFetchResponse,
    ChatHealthResponse,
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatSendRequest,
    ChatSendResponse,
    DirectActionResponse,
    DirectMessageRequest,
    EditMessageRequest,
    PendingActionResponse,
)
from app.services import (
    chat_session,
    discord_api,
    discord_executor,
    intent_parser,
    llm_client,
)
from app.services import tenant_settings as tenant_settings_service
from app.services.audit import record_event


# Max prior messages handed to the LLM as context. 10 = roughly 5 user /
# assistant exchanges. Bounded so token spend + cache invalidations stay
# predictable; older context is still in Postgres but invisible to the model.
_HISTORY_TURNS = 10


def _load_history(
    db: Session, tenant_id: UUID, user_id: UUID
) -> list[dict[str, str]]:
    """Pull the most recent _HISTORY_TURNS messages and convert to the
    OpenAI message format the LLM clients expect. Returned in chronological
    order (oldest first) — the LLM expects the user's current question last.

    We strip action metadata: the model sees the assistant's spoken reply
    only, not the JSON tool-call structure. That's enough context for
    follow-up turns and avoids confusing the model into thinking the same
    tool call should be re-issued.
    """
    recent = chat_session.list_messages(db, tenant_id, user_id)
    if not recent:
        return []
    tail = recent[-_HISTORY_TURNS:]
    return [{"role": m.role, "content": m.content} for m in tail if m.content]


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/health", response_model=ChatHealthResponse)
def chat_health() -> ChatHealthResponse:
    """Public-facing description of the active intent backend.

    Intentionally not tenant-gated: the frontend uses this on app boot to
    decide whether to show the "Powered by {model}" badge in ChatOps.
    """
    info = llm_client.info()
    return ChatHealthResponse(
        llm_enabled=info.enabled,
        provider=info.provider,
        model=info.model,
    )


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
    db: Session = Depends(get_db),
) -> ChatHistoryResponse:
    return ChatHistoryResponse(
        messages=[
            _to_message_response(m)
            for m in chat_session.list_messages(db, tenant_id, user.id)
        ]
    )


def _sse(event: str, data: dict) -> bytes:
    """Format a single Server-Sent Event frame. Both fields are required by
    the spec; data must end with two newlines to mark the frame boundary."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode("utf-8")


@router.post("/messages/stream")
async def stream_message(
    payload: ChatSendRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Server-Sent Events variant of POST /messages.

    Wire format (one JSON object per event frame):
        event: start    data: {"user_message": <ChatMessageResponse>}
        event: delta    data: {"text": "..."}             (0..N of these)
        event: complete data: {"assistant_message": <ChatMessageResponse>}
        event: error    data: {"detail": "..."}           (terminal, on failure)

    The client appends each delta to the active assistant bubble, then
    swaps in the full ChatMessageResponse on `complete` (which carries the
    intent_kind + action card payload).
    """
    # Load history BEFORE appending the new user message — the LLM client
    # adds the current user_message as the last entry itself.
    history = _load_history(db, tenant_id, user.id)
    user_msg = chat_session.append_user_message(db, tenant_id, user.id, payload.text)

    async def _emit():
        # Tell the client which message id to render under so we don't have
        # to wait for the first delta before showing the user bubble.
        yield _sse("start", {"user_message": _to_message_response(user_msg).model_dump(mode="json")})

        from app.services.intent_types import ParsedIntent  # local import — avoids cycle at module load

        final_intent: ParsedIntent | None = None
        streamed_any_text = False

        try:
            async for event in intent_parser.parse_stream(payload.text, history=history):
                if event.delta:
                    streamed_any_text = True
                    yield _sse("delta", {"text": event.delta})
                if event.done:
                    final_intent = event.final
                    break
        except Exception as exc:  # noqa: BLE001 — emit + finish, don't 500 mid-stream
            yield _sse("error", {"detail": f"stream failed: {exc!s}"})
            return

        if final_intent is None:
            yield _sse("error", {"detail": "no intent produced"})
            return

        # If the parser never emitted any delta (e.g. the model went straight
        # to a tool call with no accompanying text), backfill the templated
        # reply as one chunk so the bubble isn't empty before `complete`.
        if not streamed_any_text and final_intent.assistant_reply:
            yield _sse("delta", {"text": final_intent.assistant_reply})

        assistant_msg = chat_session.append_assistant_reply(db, tenant_id, user.id, final_intent)
        yield _sse(
            "complete",
            {"assistant_message": _to_message_response(assistant_msg).model_dump(mode="json")},
        )

    return StreamingResponse(
        _emit(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # tell nginx not to buffer if we ever sit behind it
        },
    )


@router.post("/messages", response_model=ChatSendResponse)
async def send_message(
    payload: ChatSendRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatSendResponse:
    history = _load_history(db, tenant_id, user.id)
    intent = await intent_parser.parse(payload.text, history=history)
    user_msg = chat_session.append_user_message(db, tenant_id, user.id, payload.text)
    assistant_msg = chat_session.append_assistant_reply(db, tenant_id, user.id, intent)
    return ChatSendResponse(
        user_message=_to_message_response(user_msg),
        assistant_message=_to_message_response(assistant_msg),
    )


@router.post("/messages/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_session(
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    chat_session.reset(db, tenant_id, user.id)


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


def _get_guild_id(db: Session, tenant_id: UUID) -> str | None:
    guild_row = db.scalar(select(DiscordGuild).where(DiscordGuild.tenant_id == tenant_id))
    return guild_row.discord_guild_id if guild_row else None


async def _resolve_member(guild_id: str, query: str) -> tuple[dict | None, str | None]:
    """Returns (member, error). Falls back to None,error when the bot can't see
    the member — usually because the GUILD_MEMBERS privileged intent isn't on."""
    if not query:
        return None, "No target specified"
    members = await discord_api.search_member(guild_id, query)
    if members is None:
        return None, (
            f"Could not look up @{query}. Enable the GUILD_MEMBERS "
            "privileged intent in your Discord Developer Portal."
        )
    if len(members) == 0:
        return None, f"No member matching @{query}"
    return members[0], None


async def _ensure_channel_in_tenant(db: Session, tenant_id: UUID, channel_id: str) -> str | None:
    """Returns an error string if the channel isn't part of the tenant's guild.

    Direct-action endpoints accept a raw channel id from the client, so we
    have to confirm it belongs to the tenant's linked Discord guild before
    touching it — otherwise a caller could moderate any channel whose id
    they guess.
    """
    guild_id = _get_guild_id(db, tenant_id)
    if guild_id is None:
        return "No Discord guild linked to this tenant"
    channels = await discord_api.get_guild_channels(guild_id)
    if channels is None:
        return "Could not reach Discord (check DISCORD_BOT_TOKEN and bot membership)"
    if not any(str(c.get("id")) == str(channel_id) for c in channels):
        return "Channel does not belong to this tenant's server"
    return None


async def _execute(
    db: Session,
    tenant_id: UUID,
    action: chat_session.PendingAction,
) -> dict:
    """Returns the receipt dict to store on the action."""
    guild_id = _get_guild_id(db, tenant_id)
    if guild_id is None:
        return {"mode": "live", "ok": False, "note": "No Discord guild linked to this tenant"}

    if action.kind in ("slowmode", "announce"):
        channel_id, channel_err = await _resolve_target_channel(db, tenant_id)
        if channel_err or channel_id is None:
            return {"mode": "live", "ok": False, "note": channel_err or "No target channel"}

        if action.kind == "slowmode":
            result = await discord_executor.set_channel_slowmode(
                channel_id=channel_id, seconds=int(action.params.get("seconds", 0))
            )
        else:
            result = await discord_executor.post_announcement(
                channel_id=channel_id, content=str(action.params.get("text", ""))
            )

    elif action.kind in ("role_assign", "role_remove"):
        target = str(action.params.get("target", "")).strip()
        role_name = str(action.params.get("role", "")).strip()
        member, lookup_err = await _resolve_member(guild_id, target)
        if lookup_err or member is None:
            return {"mode": "live", "ok": False, "note": lookup_err or "No target member"}
        user_obj = member.get("user") or {}
        user_id = str(user_obj.get("id") or "")
        if not user_id:
            return {"mode": "live", "ok": False, "note": "Resolved member has no id"}

        role = await discord_api.find_role(guild_id, role_name)
        if role is None:
            return {
                "mode": "live",
                "ok": False,
                "note": f"No role matching '{role_name}' in this server",
            }

        result = await discord_executor.set_member_role(
            guild_id=guild_id,
            user_id=user_id,
            role_id=str(role.get("id") or ""),
            add=(action.kind == "role_assign"),
            reason=str(action.params.get("reason") or "") or None,
        )
        result.details["resolved_username"] = user_obj.get("username") or target
        result.details["resolved_role"] = role.get("name") or role_name

    elif action.kind in ("timeout", "kick", "ban"):
        target = str(action.params.get("target", "")).strip()
        member, lookup_err = await _resolve_member(guild_id, target)
        if lookup_err or member is None:
            return {"mode": "live", "ok": False, "note": lookup_err or "No target member"}
        user_obj = member.get("user") or {}
        user_id = str(user_obj.get("id") or "")
        if not user_id:
            return {"mode": "live", "ok": False, "note": "Resolved member has no id"}

        if action.kind == "timeout":
            result = await discord_executor.timeout_member(
                guild_id=guild_id,
                user_id=user_id,
                seconds=int(action.params.get("seconds", 600)),
                reason=str(action.params.get("reason") or "") or None,
            )
        elif action.kind == "kick":
            result = await discord_executor.kick_member(
                guild_id=guild_id,
                user_id=user_id,
                reason=str(action.params.get("reason") or "") or None,
            )
        else:  # ban
            purge_seconds = int(action.params.get("purge_hours", 0)) * 3600
            result = await discord_executor.ban_member(
                guild_id=guild_id,
                user_id=user_id,
                reason=str(action.params.get("reason") or "") or None,
                purge_seconds=purge_seconds,
            )

        # Stash the resolved identity on the receipt so the audit trail
        # records which Discord user was actually moved on, not just the
        # raw query string the model produced.
        result.details["resolved_username"] = user_obj.get("username") or target

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
    action = chat_session.get_action(db, tenant_id, user.id, action_id)
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

    chat_session.update_action(db, tenant_id, user.id, action_id, status="executed", receipt=receipt)

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

    updated = chat_session.get_action(db, tenant_id, user.id, action_id)
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
    db: Session = Depends(get_db),
) -> ActionResolutionResponse:
    action = chat_session.get_action(db, tenant_id, user.id, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.status != "pending":
        raise HTTPException(status_code=409, detail=f"Action already {action.status}")

    chat_session.update_action(db, tenant_id, user.id, action_id, status="cancelled")
    updated = chat_session.get_action(db, tenant_id, user.id, action_id)
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


# ---------------------------------------------------------------------------
# Direct (non-AI) message + channel actions. All scope checks go through
# _ensure_channel_in_tenant so a caller can't moderate channels outside their
# own guild even if they brute-force a channel id.
# ---------------------------------------------------------------------------


def _direct_audit(
    db: Session,
    *,
    tenant_id: UUID,
    user_id: UUID,
    event_type: str,
    summary: str,
    risk_tier: str,
    details: dict,
) -> None:
    record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=user_id,
        event_type=event_type,
        summary=summary,
        risk_tier=risk_tier,
        details=details,
    )
    db.commit()


@router.post(
    "/direct-message",
    response_model=DirectActionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_direct_message(
    payload: DirectMessageRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """Send a plain text message to a channel without going through the AI."""
    err = await _ensure_channel_in_tenant(db, tenant_id, payload.channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    result = await discord_executor.post_announcement(
        channel_id=payload.channel_id, content=payload.text
    )
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discord error: {result.message}",
        )

    _direct_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        event_type="chat.direct_message.sent",
        summary=f"Direct message sent to channel {payload.channel_id}",
        risk_tier="low",
        details={
            "channel_id": payload.channel_id,
            "text": payload.text,
            "discord_response": result.details,
        },
    )
    return DirectActionResponse(ok=True, message="Message sent", details=result.details)


@router.put(
    "/channels/{channel_id}/messages/{message_id}",
    response_model=DirectActionResponse,
)
async def edit_direct_message(
    channel_id: str,
    message_id: str,
    payload: EditMessageRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    err = await _ensure_channel_in_tenant(db, tenant_id, channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    result = await discord_executor.edit_message(
        channel_id=channel_id, message_id=message_id, content=payload.text
    )
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discord error: {result.message}",
        )

    _direct_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        event_type="chat.direct_message.updated",
        summary=f"Message {message_id} updated in channel {channel_id}",
        risk_tier="low",
        details={
            "channel_id": channel_id,
            "message_id": message_id,
            "new_text": payload.text,
            "discord_response": result.details,
        },
    )
    return DirectActionResponse(ok=True, message="Message updated", details=result.details)


@router.delete(
    "/channels/{channel_id}/messages/{message_id}",
    response_model=DirectActionResponse,
)
async def delete_direct_message(
    channel_id: str,
    message_id: str,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    err = await _ensure_channel_in_tenant(db, tenant_id, channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    result = await discord_executor.delete_message(
        channel_id=channel_id, message_id=message_id
    )
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discord error: {result.message}",
        )

    _direct_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        event_type="chat.direct_message.deleted",
        summary=f"Message {message_id} deleted from channel {channel_id}",
        risk_tier="medium",
        details={
            "channel_id": channel_id,
            "message_id": message_id,
            "discord_response": result.details,
        },
    )
    return DirectActionResponse(ok=True, message="Message deleted", details=result.details)


@router.post(
    "/channels/{channel_id}/messages/bulk-delete",
    response_model=DirectActionResponse,
)
async def bulk_delete_messages(
    channel_id: str,
    payload: BulkDeleteRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    err = await _ensure_channel_in_tenant(db, tenant_id, channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    result = await discord_executor.bulk_delete_messages(
        channel_id=channel_id, message_ids=payload.message_ids
    )
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discord error: {result.message}",
        )

    _direct_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        event_type="chat.direct_message.bulk_deleted",
        summary=f"Bulk-deleted {len(payload.message_ids)} messages from {channel_id}",
        risk_tier="high",
        details={
            "channel_id": channel_id,
            "message_ids": payload.message_ids,
            "discord_response": result.details,
        },
    )
    return DirectActionResponse(
        ok=True,
        message=f"Deleted {len(payload.message_ids)} messages",
        details=result.details,
    )


@router.get(
    "/channels/{channel_id}/messages",
    response_model=list[ChannelMessageFetchResponse],
)
async def fetch_channel_messages(
    channel_id: str,
    limit: int = 50,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChannelMessageFetchResponse]:
    """Read recent messages from a channel for rendering in the UI."""
    err = await _ensure_channel_in_tenant(db, tenant_id, channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    limit = max(1, min(limit, 100))
    messages = await discord_api.fetch_channel_messages(channel_id, limit=limit)
    if messages is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Discord",
        )

    out: list[ChannelMessageFetchResponse] = []
    for m in messages:
        author = m.get("author") or {}
        out.append(
            ChannelMessageFetchResponse(
                id=str(m.get("id") or ""),
                content=str(m.get("content") or ""),
                author={
                    "id": str(author.get("id") or ""),
                    "username": str(author.get("username") or ""),
                    "discriminator": str(author.get("discriminator") or "0"),
                    "avatar": author.get("avatar"),
                },
                timestamp=str(m.get("timestamp") or ""),
            )
        )
    return out


@router.post(
    "/channels/{channel_id}/lock",
    response_model=DirectActionResponse,
)
async def lock_channel(
    channel_id: str,
    payload: ChannelLockRequest,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DirectActionResponse:
    """Emergency channel lockdown — denies SEND_MESSAGES to @everyone."""
    err = await _ensure_channel_in_tenant(db, tenant_id, channel_id)
    if err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err)

    guild_id = _get_guild_id(db, tenant_id)
    if guild_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No Discord guild linked to this tenant",
        )

    result = await discord_executor.lock_channel(
        channel_id=channel_id, guild_id=guild_id, reason=payload.reason
    )
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discord error: {result.message}",
        )

    _direct_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        event_type="chat.channel.locked",
        summary=f"Channel {channel_id} locked. Reason: {payload.reason}",
        risk_tier="high",
        details={
            "channel_id": channel_id,
            "reason": payload.reason,
            "discord_response": result.details,
        },
    )
    return DirectActionResponse(ok=True, message="Channel locked", details=result.details)
