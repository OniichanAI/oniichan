"""Actual Discord side-effects, gated by tenant settings upstream.

Every call here mutates the Discord state of someone's server, so each helper
returns a structured result the caller writes into an audit event verbatim.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.core.config import settings


_BASE = "https://discord.com/api/v10"


@dataclass
class ExecutionResult:
    ok: bool
    status_code: int
    message: str
    details: dict[str, Any]


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bot {settings.discord_bot_token}",
        "Content-Type": "application/json",
    }


async def set_channel_slowmode(channel_id: str, seconds: int) -> ExecutionResult:
    """PATCH /channels/{id} with rate_limit_per_user."""
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})
    seconds = max(0, min(seconds, 21600))
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(
            f"{_BASE}/channels/{channel_id}",
            headers=_headers(),
            json={"rate_limit_per_user": seconds},
        )
    return ExecutionResult(
        ok=response.status_code == 200,
        status_code=response.status_code,
        message=("Slow mode updated" if response.status_code == 200 else response.text[:200]),
        details={"channel_id": channel_id, "seconds": seconds},
    )


_TIMEOUT_MIN_SECONDS = 60          # 1 minute floor — anything shorter is useless
_TIMEOUT_MAX_SECONDS = 28 * 86400  # 28 days — Discord's hard cap


async def timeout_member(
    guild_id: str,
    user_id: str,
    seconds: int,
    *,
    reason: str | None = None,
) -> ExecutionResult:
    """PATCH /guilds/{id}/members/{user_id} with communication_disabled_until.

    Discord auto-lifts the timeout when the timestamp passes — no scheduled
    cleanup needed on our side. Passing seconds=0 explicitly clears the
    timeout.
    """
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})

    headers = _headers()
    if reason:
        # X-Audit-Log-Reason shows up in Discord's own audit log alongside ours.
        headers["X-Audit-Log-Reason"] = reason[:512]

    if seconds <= 0:
        until_iso = None
    else:
        clamped = max(_TIMEOUT_MIN_SECONDS, min(seconds, _TIMEOUT_MAX_SECONDS))
        until_iso = (datetime.now(UTC) + timedelta(seconds=clamped)).isoformat()

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(
            f"{_BASE}/guilds/{guild_id}/members/{user_id}",
            headers=headers,
            json={"communication_disabled_until": until_iso},
        )
    ok = response.status_code in (200, 204)
    return ExecutionResult(
        ok=ok,
        status_code=response.status_code,
        message=(
            ("Timeout cleared" if seconds <= 0 else "Member timed out")
            if ok
            else response.text[:200]
        ),
        details={"guild_id": guild_id, "user_id": user_id, "until": until_iso, "seconds": seconds},
    )


_BAN_PURGE_MAX_SECONDS = 7 * 86400  # Discord cap on delete_message_seconds


async def kick_member(
    guild_id: str,
    user_id: str,
    *,
    reason: str | None = None,
) -> ExecutionResult:
    """DELETE /guilds/{id}/members/{user_id} — removes the user.

    Kick is reversible by the user (they can rejoin via any invite they still
    have). Discord returns 204 on success.
    """
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})
    headers = _headers()
    if reason:
        headers["X-Audit-Log-Reason"] = reason[:512]
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.delete(
            f"{_BASE}/guilds/{guild_id}/members/{user_id}",
            headers=headers,
        )
    ok = response.status_code == 204
    return ExecutionResult(
        ok=ok,
        status_code=response.status_code,
        message="Member kicked" if ok else response.text[:200],
        details={"guild_id": guild_id, "user_id": user_id},
    )


async def ban_member(
    guild_id: str,
    user_id: str,
    *,
    reason: str | None = None,
    purge_seconds: int = 0,
) -> ExecutionResult:
    """PUT /guilds/{id}/bans/{user_id} — bans the user.

    `purge_seconds` (max 7 days) deletes the user's recent messages across
    every channel — useful when banning spammers so their content goes too.
    Discord returns 204 on success.
    """
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})
    headers = _headers()
    if reason:
        headers["X-Audit-Log-Reason"] = reason[:512]
    purge_seconds = max(0, min(purge_seconds, _BAN_PURGE_MAX_SECONDS))
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.put(
            f"{_BASE}/guilds/{guild_id}/bans/{user_id}",
            headers=headers,
            json={"delete_message_seconds": purge_seconds},
        )
    ok = response.status_code == 204
    return ExecutionResult(
        ok=ok,
        status_code=response.status_code,
        message="Member banned" if ok else response.text[:200],
        details={
            "guild_id": guild_id,
            "user_id": user_id,
            "purge_seconds": purge_seconds,
        },
    )


async def set_member_role(
    guild_id: str,
    user_id: str,
    role_id: str,
    *,
    add: bool,
    reason: str | None = None,
) -> ExecutionResult:
    """PUT or DELETE /guilds/{id}/members/{user_id}/roles/{role_id}.

    `add=True` grants the role; `add=False` removes it. Both reversible —
    medium-risk. Discord returns 204 on success.
    """
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})
    headers = _headers()
    if reason:
        headers["X-Audit-Log-Reason"] = reason[:512]
    url = f"{_BASE}/guilds/{guild_id}/members/{user_id}/roles/{role_id}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = (
            await client.put(url, headers=headers)
            if add
            else await client.delete(url, headers=headers)
        )
    ok = response.status_code == 204
    return ExecutionResult(
        ok=ok,
        status_code=response.status_code,
        message=("Role " + ("granted" if add else "removed")) if ok else response.text[:200],
        details={"guild_id": guild_id, "user_id": user_id, "role_id": role_id, "add": add},
    )


async def post_announcement(channel_id: str, content: str) -> ExecutionResult:
    """POST /channels/{id}/messages."""
    if not settings.discord_bot_token:
        return ExecutionResult(False, 0, "Bot token not configured", {})
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{_BASE}/channels/{channel_id}/messages",
            headers=_headers(),
            json={"content": content[:2000]},
        )
    ok = response.status_code in (200, 201)
    payload = response.json() if ok else {}
    return ExecutionResult(
        ok=ok,
        status_code=response.status_code,
        message=("Announcement posted" if ok else response.text[:200]),
        details={"channel_id": channel_id, "message_id": payload.get("id")},
    )
