"""Thin async wrapper around the parts of the Discord HTTP API we use server-side.

Authenticates with the application's bot token. All methods return None on
upstream failure rather than raising — callers decide whether the data is
required or just decorative.
"""
from __future__ import annotations

import httpx

from app.core.config import settings


_BASE = "https://discord.com/api/v10"


def _headers() -> dict[str, str]:
    if not settings.discord_bot_token:
        return {}
    return {"Authorization": f"Bot {settings.discord_bot_token}"}


async def _get(path: str, params: dict[str, str] | None = None) -> dict | list | None:
    headers = _headers()
    if not headers:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{_BASE}{path}", headers=headers, params=params)
        if response.status_code != 200:
            return None
        return response.json()


async def get_guild(guild_id: str) -> dict | None:
    """Includes ?with_counts=true so we get approximate_member_count back."""
    result = await _get(f"/guilds/{guild_id}", params={"with_counts": "true"})
    return result if isinstance(result, dict) else None


async def get_guild_channels(guild_id: str) -> list[dict] | None:
    result = await _get(f"/guilds/{guild_id}/channels")
    return result if isinstance(result, list) else None
