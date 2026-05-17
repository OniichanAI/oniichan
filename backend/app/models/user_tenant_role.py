from enum import StrEnum
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AppRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MODERATOR = "moderator"
    ANALYST = "analyst"
    VIEWER = "viewer"


class UserTenantRole(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_tenant_roles"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", "app_role", name="uq_user_tenant_app_role"),)

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    app_role: Mapped[AppRole] = mapped_column(
        Enum(
            AppRole,
            name="app_role",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    discord_role_id: Mapped[str | None] = mapped_column(String(32), nullable=True)

    tenant = relationship("Tenant", back_populates="role_bindings")
    user = relationship("User", back_populates="tenant_roles")
