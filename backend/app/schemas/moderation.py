from pydantic import BaseModel


class GuildSnapshot(BaseModel):
    discord_guild_id: str
    name: str
    member_count: int | None
    channel_count: int | None
    text_channel_count: int | None
    voice_channel_count: int | None


class ModerationStateResponse(BaseModel):
    guild: GuildSnapshot | None
    recent_actions: int
