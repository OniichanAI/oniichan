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
                # Removed prompt=none to prevent silent failures/hangs
            }
        )
        return f"{settings.discord_oauth_authorize_url}?{query}"

    @staticmethod
    def build_bot_install_url(guild_id: str | None = None) -> str:
        # response_type=code is required for Discord to redirect back to our
        # callback (otherwise it shows the "Opening Discord App" interstitial).
        # The returned code carries only bot/applications.commands scopes, so
        # we ignore it — we attribute the install via the existing session
        # cookie in /auth/discord/bot-installed.
        params = {
            "client_id": settings.discord_client_id,
            "scope": settings.discord_bot_scopes,
            "permissions": settings.discord_bot_permissions,
            "redirect_uri": str(settings.discord_redirect_uri),
            "response_type": "code",
        }
        if guild_id:
            params["guild_id"] = guild_id
            params["disable_guild_select"] = "true"
        query = urlencode(params)
        return f"{settings.discord_oauth_authorize_url}?{query}"

    @staticmethod
    async def fetch_guild_info(guild_id: str) -> dict | None:
        """Look up guild metadata using the app's bot token.

        Returns None if no bot token is configured or the bot isn't in the guild
        yet (Discord can race the redirect ahead of guild availability).
        """
        if not settings.discord_bot_token:
            return None
        headers = {"Authorization": f"Bot {settings.discord_bot_token}"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"https://discord.com/api/v10/guilds/{guild_id}",
                headers=headers,
            )
            if response.status_code != 200:
                return None
            return response.json()

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

    @staticmethod
    async def get_user_guilds(access_token: str) -> list[dict]:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get("https://discord.com/api/users/@me/guilds", headers=headers)
            response.raise_for_status()
            return response.json()
