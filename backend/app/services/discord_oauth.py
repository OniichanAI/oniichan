from __future__ import annotations

import secrets
from urllib.parse import urlencode

import httpx

from app.core.config import settings


class DiscordOAuthService:
    @staticmethod
    def build_authorization_url(state: str) -> str:
        query = urlencode(
            {
                "client_id": settings.discord_client_id,
                "redirect_uri": str(settings.discord_redirect_uri),
                "response_type": "code",
                "scope": settings.discord_oauth_scopes,
                "state": state,
                "prompt": "none",
            }
        )
        return f"{settings.discord_oauth_authorize_url}?{query}"

    @staticmethod
    def build_bot_install_url(guild_id: str | None = None) -> str:
        params = {
            "client_id": settings.discord_client_id,
            "scope": settings.discord_bot_scopes,
            "permissions": settings.discord_bot_permissions,
        }
        if guild_id:
            params["guild_id"] = guild_id
            params["disable_guild_select"] = "true"
        query = urlencode(params)
        return f"{settings.discord_oauth_authorize_url}?{query}"

    @staticmethod
    def generate_state() -> str:
        return secrets.token_urlsafe(24)

    @staticmethod
    async def exchange_code_for_token(code: str) -> dict:
        payload = {
            "client_id": settings.discord_client_id,
            "client_secret": settings.discord_client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": str(settings.discord_redirect_uri),
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(str(settings.discord_oauth_token_url), data=payload, headers=headers)
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def get_user_identity(access_token: str) -> dict:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get("https://discord.com/api/users/@me", headers=headers)
            response.raise_for_status()
            return response.json()
