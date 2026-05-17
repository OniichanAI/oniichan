from pydantic import BaseModel


class DiscordLoginResponse(BaseModel):
    authorization_url: str
    state: str


class DiscordUserIdentity(BaseModel):
    discord_user_id: str
    username: str
    global_name: str | None
    avatar_hash: str | None


class DiscordBotInstallResponse(BaseModel):
    install_url: str


class BotInstalledRequest(BaseModel):
    guild_id: str
