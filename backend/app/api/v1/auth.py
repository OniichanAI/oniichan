from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_signed_state, decode_signed_state
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import DiscordBotInstallResponse, DiscordLoginResponse, DiscordUserIdentity
from app.services.discord_oauth import DiscordOAuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/discord/login", response_model=DiscordLoginResponse)
def discord_login(response: Response) -> DiscordLoginResponse:
    nonce = DiscordOAuthService.generate_state()
    state_token = create_signed_state({"nonce": nonce})
    authorization_url = DiscordOAuthService.build_authorization_url(state=state_token)
    response.set_cookie(
        key="oauth_state",
        value=state_token,
        max_age=600,
        httponly=True,
        secure=False,
        samesite="lax",
    )
    return DiscordLoginResponse(authorization_url=authorization_url, state=nonce)


@router.get("/discord/bot-install-url", response_model=DiscordBotInstallResponse)
def discord_bot_install_url(guild_id: str | None = None) -> DiscordBotInstallResponse:
    install_url = DiscordOAuthService.build_bot_install_url(guild_id=guild_id)
    return DiscordBotInstallResponse(install_url=install_url)


@router.get("/discord/callback", response_model=DiscordUserIdentity)
async def discord_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> DiscordUserIdentity:
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")

    decoded_state = decode_signed_state(state)
    if not decoded_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expired or invalid OAuth state")

    token_data = await DiscordOAuthService.exchange_code_for_token(code=code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discord token exchange failed")

    identity = await DiscordOAuthService.get_user_identity(access_token=access_token)
    discord_user_id = identity["id"]

    user = db.scalar(select(User).where(User.discord_user_id == discord_user_id))
    if user is None:
        user = User(
            id=uuid4(),
            discord_user_id=discord_user_id,
            username=identity.get("username", "unknown"),
            global_name=identity.get("global_name"),
            avatar_hash=identity.get("avatar"),
        )
        db.add(user)
    else:
        user.username = identity.get("username", user.username)
        user.global_name = identity.get("global_name")
        user.avatar_hash = identity.get("avatar")
    db.commit()

    return DiscordUserIdentity(
        discord_user_id=user.discord_user_id,
        username=user.username,
        global_name=user.global_name,
        avatar_hash=user.avatar_hash,
    )
