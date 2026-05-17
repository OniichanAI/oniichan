"""tenant settings

Revision ID: 20260517_000002
Revises: 20260517_000001
Create Date: 2026-05-17 22:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260517_000002"
down_revision = "20260517_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_settings",
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("execution_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("autonomy_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("max_risk_tier", sa.String(length=10), nullable=False, server_default="low"),
        sa.Column("kill_switch_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("tenant_settings")
