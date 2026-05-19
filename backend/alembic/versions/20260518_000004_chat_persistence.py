"""chat persistence: chat_messages + chat_actions

Revision ID: 20260518_000004
Revises: 20260518_000003
Create Date: 2026-05-18 08:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260518_000004"
down_revision = "20260518_000003"
branch_labels = None
depends_on = None


_ROLE_ENUM = postgresql.ENUM("user", "assistant", name="chat_role", create_type=False)
_STATUS_ENUM = postgresql.ENUM(
    "pending", "confirmed", "cancelled", "executed", "expired",
    name="chat_action_status", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    postgresql.ENUM("user", "assistant", name="chat_role").create(bind, checkfirst=True)
    postgresql.ENUM(
        "pending", "confirmed", "cancelled", "executed", "expired",
        name="chat_action_status",
    ).create(bind, checkfirst=True)

    op.create_table(
        "chat_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("summary", sa.String(255), nullable=False),
        sa.Column("risk_tier", sa.String(10), nullable=False),
        sa.Column("params", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("requires_confirmation", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("status", _STATUS_ENUM, nullable=False, server_default="pending"),
        sa.Column("receipt", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", _ROLE_ENUM, nullable=False),
        sa.Column("content", sa.Text, nullable=False, server_default=""),
        sa.Column("intent_kind", sa.String(64), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column(
            "action_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_actions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_chat_messages_tenant_user_time",
        "chat_messages",
        ["tenant_id", "user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_tenant_user_time", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("chat_actions")
    bind = op.get_bind()
    _ROLE_ENUM.drop(bind, checkfirst=True)
    _STATUS_ENUM.drop(bind, checkfirst=True)
