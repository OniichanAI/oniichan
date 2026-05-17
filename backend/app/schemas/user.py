from typing import Optional

from pydantic import BaseModel

from app.schemas.tenant import TenantResponse


class UserResponse(BaseModel):
    discord_user_id: str
    username: str
    global_name: Optional[str] = None
    avatar_hash: Optional[str] = None

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserResponse
    tenants: list[TenantResponse]
