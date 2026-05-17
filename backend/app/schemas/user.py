from pydantic import BaseModel
from typing import Optional

class UserResponse(BaseModel):
    discord_user_id: str
    username: str
    global_name: Optional[str] = None
    avatar_hash: Optional[str] = None

    class Config:
        from_attributes = True
