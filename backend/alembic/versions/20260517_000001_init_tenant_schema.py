"""init tenant schema

Revision ID: 20260517_000001
Revises: None
Create Date: 2026-05-17 00:00:01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_000001"
down_revision = None
branch_labels = None
depends_on = None


app_role_enum = postgresql.ENUM("owner", "admin", "moderator", "analyst", "viewer", name="app_role", create_type=False)


def upgrade() -> None:
    postgresql.ENUM("owner", "admin", "moderator", "analyst", "viewer", name="app_role").create(
        op.get_bind(), checkfirst=True
    )

    op.create_table(
        "tenants",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("slug", name="uq_tenants_slug"),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"], unique=True)

    op.create_table(
        "users",
        sa.Column("discord_user_id", sa.String(length=32), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("global_name", sa.String(length=120), nullable=True),
        sa.Column("avatar_hash", sa.String(length=255), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("discord_user_id", name="uq_users_discord_user_id"),
    )
    op.create_index("ix_users_discord_user_id", "users", ["discord_user_id"], unique=True)

    op.create_table(
        "discord_guilds",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("discord_guild_id", sa.String(length=32), nullable=False),
        sa.Column("guild_name", sa.String(length=200), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "discord_guild_id", name="uq_tenant_discord_guild"),
    )
    op.create_index("ix_discord_guilds_tenant_id", "discord_guilds", ["tenant_id"], unique=False)
    op.create_index("ix_discord_guilds_discord_guild_id", "discord_guilds", ["discord_guild_id"], unique=False)

    op.create_table(
        "user_tenant_roles",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("app_role", app_role_enum, nullable=False),
        sa.Column("discord_role_id", sa.String(length=32), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "user_id", "app_role", name="uq_user_tenant_app_role"),
    )

    op.create_table(
        "discord_bot_credentials",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("discord_guild_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("encrypted_bot_token", sa.Text(), nullable=False),
        sa.Column("bot_user_id", sa.String(length=32), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["discord_guild_id"], ["discord_guilds.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "discord_guild_id", name="uq_tenant_guild_credential"),
    )
    op.create_index("ix_discord_bot_credentials_tenant_id", "discord_bot_credentials", ["tenant_id"], unique=False)
    op.create_index("ix_discord_bot_credentials_discord_guild_id", "discord_bot_credentials", ["discord_guild_id"], unique=False)

    op.create_table(
        "audit_events",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("risk_tier", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_audit_events_tenant_id", "audit_events", ["tenant_id"], unique=False)
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_event_type", table_name="audit_events")
    op.drop_index("ix_audit_events_tenant_id", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_index("ix_discord_bot_credentials_discord_guild_id", table_name="discord_bot_credentials")
    op.drop_index("ix_discord_bot_credentials_tenant_id", table_name="discord_bot_credentials")
    op.drop_table("discord_bot_credentials")

    op.drop_table("user_tenant_roles")

    op.drop_index("ix_discord_guilds_discord_guild_id", table_name="discord_guilds")
    op.drop_index("ix_discord_guilds_tenant_id", table_name="discord_guilds")
    op.drop_table("discord_guilds")

    op.drop_index("ix_users_discord_user_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_tenants_slug", table_name="tenants")
    op.drop_table("tenants")

    app_role_enum.drop(op.get_bind(), checkfirst=True)
