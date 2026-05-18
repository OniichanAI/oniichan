"""Pytest fixtures for the backend test suite.

Isolation model:
  - Tests run against a dedicated `discord_ops_test` database (separate from
    the dev DB) so they can never corrupt real data.
  - Schema is created once per session via Alembic (`upgrade head`).
  - Each test runs inside its own transaction that's rolled back at teardown,
    so no test sees another's writes — order-independent and re-runnable.
  - The FastAPI app's `get_db` dependency is overridden to yield the per-test
    session, so HTTP handlers and the test code talk to the same transaction.

Auth model in tests:
  - `authenticated_client` issues a real JWT session_token for a fresh user
    and tenant, sets it as a cookie. This exercises the full auth middleware
    end-to-end — no mocking of `get_current_user`.
"""
from __future__ import annotations

import os
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

# Force the test DB before importing the app. Settings reads env at import.
os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://postgres:postgres@postgres:5432/discord_ops_test"
)
os.environ.setdefault("SESSION_SIGNING_SECRET", "test-secret-32-chars-long-enough-for-jwt")

# Disable the LLM during tests so we never hit a real API key.
os.environ["LLM_API_KEY"] = ""

from alembic import command  # noqa: E402
from alembic.config import Config as AlembicConfig  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.security import ALGORITHM  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.models.tenant_settings import TenantSettings  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.user_tenant_role import AppRole, UserTenantRole  # noqa: E402


# ---------- engine / schema ----------


@pytest.fixture(scope="session")
def engine():
    """One engine for the whole session, pointed at the test DB."""
    engine = create_engine(settings.database_url, future=True)
    return engine


@pytest.fixture(scope="session", autouse=True)
def _setup_schema(engine) -> Iterator[None]:
    """Apply migrations once per test session.

    We reset to a clean slate first so a previous session's schema (e.g. from
    an in-progress migration during local hacking) can't poison this run.
    """
    with engine.begin() as conn:
        # Nuke everything in public schema — fastest reliable reset.
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    cfg = AlembicConfig("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")
    yield


# ---------- per-test session with rollback ----------


@pytest.fixture
def db(engine) -> Generator[Session, None, None]:
    """Open a connection + transaction per test and roll back on teardown.

    Uses the "join" pattern so any nested commits inside the app code don't
    actually commit to the DB; they become SAVEPOINTs inside the outer
    transaction that disappears on rollback.
    """
    connection = engine.connect()
    transaction = connection.begin()
    Sess = sessionmaker(bind=connection, autoflush=False, expire_on_commit=False)
    session = Sess()

    # If the app calls session.commit(), reopen a nested SAVEPOINT so the
    # outer transaction stays alive for the next call.
    nested = connection.begin_nested()

    @sqlalchemy_event_after_savepoint(session)
    def restart_savepoint(sess: Session, trans) -> None:
        nonlocal nested
        if trans.nested and not trans._parent.nested:  # type: ignore[attr-defined]
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def sqlalchemy_event_after_savepoint(session):
    """Decorator helper: registers `after_transaction_end` event listener."""
    from sqlalchemy import event

    def _wrap(fn):
        event.listen(session, "after_transaction_end", fn)
        return fn

    return _wrap


# ---------- HTTP client wired to the per-test session ----------


@pytest.fixture
def client(db) -> Generator[TestClient, None, None]:
    """TestClient with the get_db dependency pointed at our isolated session."""

    def _override_get_db():
        try:
            yield db
        finally:
            pass  # don't close — the `db` fixture owns the lifecycle.

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# ---------- factories ----------


def _make_session_token(discord_user_id: str) -> str:
    expires = datetime.now(UTC) + timedelta(days=1)
    return jwt.encode(
        {"sub": discord_user_id, "exp": expires},
        settings.session_signing_secret,
        algorithm=ALGORITHM,
    )


@pytest.fixture
def make_user(db):
    """Factory: create a User row and return it."""

    def _make(*, discord_user_id: str | None = None, username: str = "tester") -> User:
        user = User(
            id=uuid4(),
            discord_user_id=discord_user_id or f"discord-{uuid4().hex[:12]}",
            username=username,
            global_name=username,
            avatar_hash=None,
        )
        db.add(user)
        db.flush()
        return user

    return _make


@pytest.fixture
def make_tenant(db):
    """Factory: create a Tenant + TenantSettings row."""

    def _make(*, name: str = "Test Server", slug: str | None = None) -> Tenant:
        slug = slug or f"tenant-{uuid4().hex[:10]}"
        tenant = Tenant(id=uuid4(), name=name, slug=slug)
        db.add(tenant)
        db.flush()
        db.add(TenantSettings(tenant_id=tenant.id))
        db.flush()
        return tenant

    return _make


@pytest.fixture
def make_membership(db):
    """Factory: link a user to a tenant with a role (default OWNER)."""

    def _make(*, user: User, tenant: Tenant, role: AppRole = AppRole.OWNER) -> UserTenantRole:
        membership = UserTenantRole(
            id=uuid4(),
            tenant_id=tenant.id,
            user_id=user.id,
            app_role=role,
        )
        db.add(membership)
        db.flush()
        return membership

    return _make


@pytest.fixture
def authenticated_client(client, make_user, make_tenant, make_membership):
    """Returns (client, user, tenant) with a valid session cookie attached.

    Default: the user is OWNER of the tenant. Use the lower-level factories
    if you want to express a more nuanced setup (e.g. user belongs to one
    tenant but tries to query another).
    """
    user = make_user()
    tenant = make_tenant()
    make_membership(user=user, tenant=tenant)

    token = _make_session_token(user.discord_user_id)
    client.cookies.set("session_token", token)

    return client, user, tenant


@pytest.fixture
def auth_headers_for():
    """Build {X-Tenant-ID: <id>} for a tenant. Common test helper."""

    def _build(tenant_id: UUID) -> dict[str, str]:
        return {"X-Tenant-ID": str(tenant_id)}

    return _build
