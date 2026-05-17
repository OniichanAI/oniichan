import re
from uuid import uuid4
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.core.security import create_signed_state, decode_signed_state, ALGORITHM
from app.core.config import settings
from app.db.session import get_db
from app.models.discord import DiscordGuild
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_tenant_role import AppRole, UserTenantRole
from app.schemas.auth import (
    BotInstalledRequest,
    DiscordBotInstallResponse,
    DiscordLoginResponse,
    DiscordUserIdentity,
)
from app.schemas.tenant import TenantResponse
from app.schemas.user import MeResponse, UserResponse
from app.services.audit import record_event
from app.services.discord_oauth import DiscordOAuthService


router = APIRouter(prefix="/auth", tags=["auth"])


def create_session_token(user_id: str) -> str:
    expires = datetime.now(UTC) + timedelta(days=7)
    payload = {"sub": user_id, "exp": expires}
    return jwt.encode(payload, settings.session_signing_secret, algorithm=ALGORITHM)


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.session_signing_secret, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
        user = db.scalar(select(User).where(User.discord_user_id == user_id))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


_PLACEHOLDER_NAME_PATTERN = re.compile(r"^Guild \d+$")
_refreshed_tenants: set[str] = set()


async def _backfill_placeholder_names(db: Session, tenants: list[Tenant]) -> None:
    """Look up real guild names for tenants stuck on the `Guild <id>` fallback.

    Runs at most once per tenant per process. Silent on failure — the
    placeholder name is harmless, just ugly.
    """
    if not settings.discord_bot_token:
        return
    for tenant in tenants:
        if not _PLACEHOLDER_NAME_PATTERN.match(tenant.name):
            continue
        if str(tenant.id) in _refreshed_tenants:
            continue
        guild = db.scalar(
            select(DiscordGuild).where(DiscordGuild.tenant_id == tenant.id)
        )
        if guild is None:
            continue
        info = await DiscordOAuthService.fetch_guild_info(guild_id=guild.discord_guild_id)
        _refreshed_tenants.add(str(tenant.id))
        if info and (name := info.get("name")):
            tenant.name = name
            guild.guild_name = name
    db.commit()


@router.get("/me", response_model=MeResponse)
async def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    tenants = list(
        db.scalars(
            select(Tenant)
            .join(UserTenantRole, UserTenantRole.tenant_id == Tenant.id)
            .where(UserTenantRole.user_id == user.id, Tenant.is_active.is_(True))
            .order_by(Tenant.name)
        ).all()
    )
    await _backfill_placeholder_names(db, tenants)
    return MeResponse(
        user=UserResponse.model_validate(user),
        tenants=[TenantResponse.model_validate(t) for t in tenants],
    )


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
        secure=False,  # Set to True in production
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
    response: Response,
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

    session_token = create_session_token(user.discord_user_id)
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=False,  # Set to True in production
        samesite="lax",
    )

    # OAuth state is single-use.
    response.delete_cookie("oauth_state")

    return DiscordUserIdentity(
        discord_user_id=user.discord_user_id,
        username=user.username,
        global_name=user.global_name,
        avatar_hash=user.avatar_hash,
    )


@router.post("/discord/bot-installed", response_model=TenantResponse)
async def discord_bot_installed(
    payload: BotInstalledRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Tenant:
    """Finalize bot install for an already-authenticated user.

    Discord's bot-install redirect returns guild_id but the access token from
    that flow only carries bot scopes — so we don't exchange it. Instead, we
    use the existing session_token to attribute the install to the user, and
    look up the guild name via the app's bot token.
    """
    guild_id = payload.guild_id.strip()
    if not guild_id.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid guild_id")

    guild_info = await DiscordOAuthService.fetch_guild_info(guild_id=guild_id)
    guild_name = (guild_info or {}).get("name") or f"Guild {guild_id}"

    discord_guild = db.scalar(
        select(DiscordGuild).where(DiscordGuild.discord_guild_id == guild_id)
    )

    if discord_guild is None:
        tenant = Tenant(
            id=uuid4(),
            name=guild_name,
            slug=f"guild-{guild_id}",
        )
        db.add(tenant)
        db.flush()

        discord_guild = DiscordGuild(
            id=uuid4(),
            tenant_id=tenant.id,
            discord_guild_id=guild_id,
            guild_name=guild_name,
        )
        db.add(discord_guild)
    else:
        tenant = db.scalar(select(Tenant).where(Tenant.id == discord_guild.tenant_id))
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Guild record without tenant",
            )
        # Keep the cached name fresh if Discord told us something newer.
        if guild_info and discord_guild.guild_name != guild_name:
            discord_guild.guild_name = guild_name
            tenant.name = guild_name

    existing_role = db.scalar(
        select(UserTenantRole).where(
            UserTenantRole.tenant_id == tenant.id,
            UserTenantRole.user_id == user.id,
        )
    )
    is_new_membership = existing_role is None
    if is_new_membership:
        db.add(
            UserTenantRole(
                id=uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                app_role=AppRole.OWNER,
            )
        )

    record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=user.id,
        event_type="tenant.provisioned" if is_new_membership else "tenant.reauthorized",
        summary=f"{user.username} installed the bot on {tenant.name}",
        risk_tier="low",
        details={"guild_id": guild_id, "guild_name": tenant.name},
    )

    db.commit()
    db.refresh(tenant)
    return tenant
