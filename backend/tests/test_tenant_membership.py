"""Tenant-membership / IDOR tests.

The core guarantee: a logged-in user supplying an X-Tenant-ID header for a
tenant they don't belong to must NEVER read or mutate that tenant's data.
These tests would catch the original IDOR bug if it ever reappears.
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_tenants_me_requires_x_tenant_id(authenticated_client) -> None:
    client, _user, _tenant = authenticated_client
    # No X-Tenant-ID header — endpoint must reject.
    response = client.get("/api/v1/tenants/me")
    assert response.status_code == 400
    assert "tenant" in response.json()["detail"].lower()


def test_tenants_me_returns_tenant_for_member(authenticated_client, auth_headers_for) -> None:
    client, _user, tenant = authenticated_client
    response = client.get("/api/v1/tenants/me", headers=auth_headers_for(tenant.id))
    assert response.status_code == 200
    assert response.json()["id"] == str(tenant.id)


def test_tenants_me_rejects_spoofed_x_tenant_id(
    authenticated_client, make_tenant, auth_headers_for
) -> None:
    """IDOR guard: the user belongs to `own_tenant`, but spoofs the header to
    point at `other_tenant`. Must be rejected — not 200, not 404 (404 would
    leak existence). 403 is the only acceptable answer.
    """
    client, _user, _own_tenant = authenticated_client
    other_tenant = make_tenant(name="Not Yours")

    response = client.get("/api/v1/tenants/me", headers=auth_headers_for(other_tenant.id))
    assert response.status_code == 403


def test_audit_endpoint_also_idor_guarded(
    authenticated_client, make_tenant, auth_headers_for
) -> None:
    """The membership check should apply everywhere — picking audit as a
    second example to lock in the pattern. Adding a new endpoint that
    forgets to gate via require_tenant_membership will fail this style of
    test on day one."""
    client, _user, _own = authenticated_client
    other = make_tenant(name="Other Server")

    response = client.get("/api/v1/audit", headers=auth_headers_for(other.id))
    assert response.status_code == 403


def test_settings_endpoint_also_idor_guarded(
    authenticated_client, make_tenant, auth_headers_for
) -> None:
    client, _user, _own = authenticated_client
    other = make_tenant(name="Other Server")

    response = client.get(
        "/api/v1/tenants/me/settings", headers=auth_headers_for(other.id)
    )
    assert response.status_code == 403


def test_chat_messages_also_idor_guarded(
    authenticated_client, make_tenant, auth_headers_for
) -> None:
    client, _user, _own = authenticated_client
    other = make_tenant(name="Other Server")

    response = client.get(
        "/api/v1/chat/messages", headers=auth_headers_for(other.id)
    )
    assert response.status_code == 403
