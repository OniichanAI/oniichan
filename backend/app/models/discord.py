from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DiscordGuild(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "discord_guilds"
    __table_args__ = (UniqueConstraint("tenant_id", "discord_guild_id", name="uq_tenant_discord_guild"),)

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discord_guild_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    guild_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    tenant = relationship("Tenant", back_populates="guilds")
    bot_credentials = relationship(
        "DiscordBotCredential", back_populates="guild", cascade="all, delete-orphan", uselist=False
    )


class DiscordBotCredential(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "discord_bot_credentials"
    __table_args__ = (UniqueConstraint("tenant_id", "discord_guild_id", name="uq_tenant_guild_credential"),)

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    discord_guild_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("discord_guilds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    encrypted_bot_token: Mapped[str] = mapped_column(Text, nullable=False)
    bot_user_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    guild = relationship("DiscordGuild", back_populates="bot_credentials")
