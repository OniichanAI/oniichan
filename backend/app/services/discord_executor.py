"""Actual Discord side-effects, gated by tenant settings upstream.

Every call here mutates the Discord state of someone's server, so each helper
returns a structured result the caller writes into an audit event verbatim.
"""
from __future__ import annotations

from dataclasses import dataclass
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
