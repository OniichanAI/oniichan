"""Auth + session tests.

Exercises the cookie-based session model end-to-end through the FastAPI
TestClient — no mocking of `get_current_user`, so middleware, JWT decoding,
and the DB lookup all participate.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
from app.core.security import ALGORITHM


def test_me_returns_401_without_cookie(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_me_returns_401_when_jwt_is_garbage(client: TestClient) -> None:
    client.cookies.set("session_token", "not-a-real-jwt")
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_returns_401_when_user_id_not_in_db(client: TestClient) -> None:
    """A perfectly-signed JWT for a user that doesn't exist must still 401 —
    the JWT proves the cookie was issued by us, not that the user still exists.
    """
    token = jwt.encode(
        {"sub": "ghost-user-99999", "exp": datetime.now(UTC) + timedelta(days=1)},
        settings.session_signing_secret,
        algorithm=ALGORITHM,
    )
    client.cookies.set("session_token", token)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_returns_user_and_tenants_when_authenticated(authenticated_client) -> None:
    client, user, tenant = authenticated_client
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200

    body = response.json()
    assert body["user"]["discord_user_id"] == user.discord_user_id
    assert body["user"]["username"] == user.username
    assert len(body["tenants"]) == 1
    assert body["tenants"][0]["id"] == str(tenant.id)
    assert body["tenants"][0]["name"] == tenant.name


def test_me_omits_tenants_user_doesnt_belong_to(
    authenticated_client, make_tenant
) -> None:
    """Sanity: creating an unrelated tenant in the DB doesn't leak it into /me."""
    client, _user, own_tenant = authenticated_client
    _other = make_tenant(name="Someone Else's Server")

    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    returned_ids = {t["id"] for t in response.json()["tenants"]}
    assert returned_ids == {str(own_tenant.id)}
