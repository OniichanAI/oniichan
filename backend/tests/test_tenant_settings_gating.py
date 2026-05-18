"""Tenant-settings safety gate.

The `allows_risk` helper is what stands between a confirmed chat action and
a real Discord side-effect. It MUST refuse execution when any of:
  - kill switch is on
  - execution toggle is off
  - the action's risk tier is above the tenant's cap

These are pure-Python unit tests; no HTTP, no DB.
"""
from __future__ import annotations

import pytest

from app.models.tenant_settings import TenantSettings
from app.services.tenant_settings import allows_risk


def _settings(
    *,
    kill: bool = False,
    execution: bool = False,
    cap: str = "low",
) -> TenantSettings:
    return TenantSettings(
        kill_switch_active=kill,
        execution_enabled=execution,
        max_risk_tier=cap,
    )


def test_default_settings_block_everything() -> None:
    """Brand-new tenant: execution off, kill switch off → still blocks."""
    s = _settings()
    assert allows_risk(s, "low") is False
    assert allows_risk(s, "medium") is False
    assert allows_risk(s, "high") is False


def test_kill_switch_overrides_everything() -> None:
    s = _settings(kill=True, execution=True, cap="high")
    assert allows_risk(s, "low") is False
    assert allows_risk(s, "medium") is False
    assert allows_risk(s, "high") is False


def test_execution_off_blocks_even_with_cap_set() -> None:
    s = _settings(execution=False, cap="high")
    assert allows_risk(s, "low") is False


@pytest.mark.parametrize(
    ("cap", "tier", "expected"),
    [
        ("low", "low", True),
        ("low", "medium", False),
        ("low", "high", False),
        ("medium", "low", True),
        ("medium", "medium", True),
        ("medium", "high", False),
        ("high", "low", True),
        ("high", "medium", True),
        ("high", "high", True),
    ],
)
def test_risk_cap_truth_table(cap: str, tier: str, expected: bool) -> None:
    s = _settings(execution=True, cap=cap)
    assert allows_risk(s, tier) is expected


def test_unknown_risk_tier_is_denied() -> None:
    """Defense in depth: any string we don't recognise must NOT pass."""
    s = _settings(execution=True, cap="high")
    assert allows_risk(s, "nuclear") is False
    assert allows_risk(s, "") is False


def test_settings_endpoint_roundtrip(authenticated_client, auth_headers_for) -> None:
    """End-to-end: PUT settings → GET reflects them.

    Covers the happy path users actually take (the wizard, the settings page).
    """
    client, _user, tenant = authenticated_client
    headers = auth_headers_for(tenant.id)

    initial = client.get("/api/v1/tenants/me/settings", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["execution_enabled"] is False
    assert initial.json()["kill_switch_active"] is False
    assert initial.json()["bootstrap_completed"] is False

    updated = client.put(
        "/api/v1/tenants/me/settings",
        json={
            "execution_enabled": True,
            "max_risk_tier": "medium",
            "bootstrap_completed": True,
        },
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["execution_enabled"] is True
    assert body["max_risk_tier"] == "medium"
    assert body["bootstrap_completed"] is True
    assert body["kill_switch_active"] is False  # unchanged

    refetch = client.get("/api/v1/tenants/me/settings", headers=headers)
    assert refetch.json() == body
