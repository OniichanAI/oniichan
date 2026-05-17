from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "AI Discord Ops Assistant API"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"
    cors_allow_origins: str = "http://localhost:4200"

    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/discord_ops"
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_redirect_uri: AnyHttpUrl = "http://localhost:8000/api/v1/auth/discord/callback"
    discord_oauth_authorize_url: AnyHttpUrl = "https://discord.com/api/oauth2/authorize"
    discord_oauth_token_url: AnyHttpUrl = "https://discord.com/api/oauth2/token"
    discord_oauth_scopes: str = "identify guilds"
    discord_bot_scopes: str = "bot applications.commands"
    discord_bot_permissions: str = "8"

    session_signing_secret: str = "change_me"
    default_tenant_header: str = "x-tenant-id"


settings = Settings()
