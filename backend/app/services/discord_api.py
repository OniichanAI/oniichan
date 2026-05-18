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


async def list_roles(guild_id: str) -> list[dict] | None:
    """GET /guilds/{id}/roles — returns all roles in the guild."""
    result = await _get(f"/guilds/{guild_id}/roles")
    return result if isinstance(result, list) else None


async def find_role(guild_id: str, name: str) -> dict | None:
    """Case-insensitive lookup of a role by name. Returns the first match
    or None. The @everyone role is excluded — it can't be assigned anyway."""
    roles = await list_roles(guild_id)
    if not roles:
        return None
    needle = name.strip().lstrip("@").lower()
    for role in roles:
        rname = (role.get("name") or "").lower()
        if rname == "@everyone":
            continue
        if rname == needle:
            return role
    # Fall back to startswith for partial matches like "mod" -> "moderator"
    for role in roles:
        rname = (role.get("name") or "").lower()
        if rname.startswith(needle) and rname != "@everyone":
            return role
    return None


async def fetch_channel_messages(channel_id: str, *, limit: int = 50) -> list[dict] | None:
    """GET /channels/{id}/messages?limit=…. Returns newest first."""
    result = await _get(
        f"/channels/{channel_id}/messages",
        params={"limit": str(max(1, min(limit, 100)))},
    )
    return result if isinstance(result, list) else None


async def search_member(guild_id: str, query: str, *, limit: int = 5) -> list[dict] | None:
    """Find guild members matching a username/display name prefix.

    Returns up to `limit` matches. The Discord endpoint requires the bot to
    have the GUILD_MEMBERS privileged intent; if that isn't enabled the call
    returns 403 and we collapse to None (caller treats as "not found").
    Requires GUILD_MEMBERS intent enabled in the Developer Portal.
    """
    query = query.strip().lstrip("@")
    if not query:
        return None
    result = await _get(
        f"/guilds/{guild_id}/members/search",
        params={"query": query, "limit": str(min(max(limit, 1), 1000))},
    )
    return result if isinstance(result, list) else None
