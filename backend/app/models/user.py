from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    discord_user_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    global_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    tenant_roles = relationship("UserTenantRole", back_populates="user", cascade="all, delete-orphan")
