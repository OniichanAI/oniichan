from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_tenant_membership
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.discord import DiscordGuild
from app.schemas.moderation import GuildSnapshot, ModerationStateResponse
from app.services import discord_api


# Discord channel type ids:
# 0=GUILD_TEXT  2=GUILD_VOICE  4=GUILD_CATEGORY  5=GUILD_ANNOUNCEMENT
# 13=GUILD_STAGE_VOICE  15=GUILD_FORUM  16=GUILD_MEDIA
# Threads (10/11/12) are transient and excluded from the "channels" tally.
_TEXT_TYPES = {0, 5, 15, 16}
_VOICE_TYPES = {2, 13}
_CATEGORY_TYPE = 4


router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.get("/state", response_model=ModerationStateResponse)
async def moderation_state(
    tenant_id: UUID = Depends(require_tenant_membership),
    db: Session = Depends(get_db),
) -> ModerationStateResponse:
    guild_row = db.scalar(
        select(DiscordGuild).where(DiscordGuild.tenant_id == tenant_id)
    )

    snapshot: GuildSnapshot | None = None
    if guild_row is not None:
        info = await discord_api.get_guild(guild_row.discord_guild_id)
        channels = await discord_api.get_guild_channels(guild_row.discord_guild_id)

        text_count: int | None = None
        voice_count: int | None = None
        category_count: int | None = None
        channel_count: int | None = None
        if channels is not None:
            text_count = sum(1 for c in channels if c.get("type") in _TEXT_TYPES)
            voice_count = sum(1 for c in channels if c.get("type") in _VOICE_TYPES)
            category_count = sum(1 for c in channels if c.get("type") == _CATEGORY_TYPE)
            channel_count = text_count + voice_count

        snapshot = GuildSnapshot(
            discord_guild_id=guild_row.discord_guild_id,
            name=(info or {}).get("name") or guild_row.guild_name,
            member_count=(info or {}).get("approximate_member_count"),
            channel_count=channel_count,
            text_channel_count=text_count,
            voice_channel_count=voice_count,
            category_count=category_count,
        )

    recent_actions = db.scalar(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.tenant_id == tenant_id)
    ) or 0

    return ModerationStateResponse(guild=snapshot, recent_actions=recent_actions)
