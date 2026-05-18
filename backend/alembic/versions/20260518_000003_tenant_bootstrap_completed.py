"""tenant settings bootstrap_completed flag

Revision ID: 20260518_000003
Revises: 20260517_000002
Create Date: 2026-05-18 01:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260518_000003"
down_revision = "20260517_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_settings",
        sa.Column(
            "bootstrap_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tenant_settings", "bootstrap_completed")
