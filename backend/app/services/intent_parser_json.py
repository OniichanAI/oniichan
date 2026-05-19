"""LLM intent parser using JSON-mode (response_format=json_object).

Works on every OpenAI-compatible endpoint, including ones without
function/tool calling. Our eval found this outperforms tool-calling on
Llama-3.1-8B class models — see eval/run_intent_eval.py.

Safety invariants — all enforced server-side, never trusted from the model:
  - Allowed-kind whitelist (anything else collapses to "chat")
  - Risk tier mapped from the kind, not the model's word
  - Confirmation requirement derived from risk tier
  - Params coerced + clamped per kind
"""
from __future__ import annotations

from typing import Any

from app.services import llm_client
from app.services.intent_types import IntentKind, ParsedIntent, RiskTier


_SYSTEM_PROMPT = """You are Oniichan, a Discord moderation intent classifier.

Your job: read what the human typed and pick exactly one intent from the
allowed list below. Never invent intents.

Allowed intents (kind):
  - slowmode      — set or disable a channel's slow-mode rate limit
  - announce      — post an announcement message to the server
  - timeout       — temporarily mute a user so they can't send messages
  - lookup_user   — get info / recent activity about a user
  - summary       — describe overall server health / counts
  - chat          — small talk, help, anything not matching the above

Required JSON keys:
  - kind:        one of the allowed intents (string)
  - summary:     short human-readable description of what we'll do (string)
  - params:      object with extracted arguments (see per-kind shapes below)
  - assistant_reply: 1–2 sentences you would say to the user, no markdown
  - confidence:  number between 0 and 1, your honest confidence

Per-kind params:
  - slowmode:    {"seconds": integer 0..21600}     (0 means disable)
  - announce:    {"text": string up to 500 chars}
  - timeout:     {"target": string username, "seconds": integer 60..2419200, "reason": string optional}
  - lookup_user: {"username": string}
  - summary:     {}
  - chat:        {}

For timeout, prefer multiples of 60. If the user says "5 minutes", that's 300.
Default to 600 (10 minutes) if no duration was given. If no target was given,
use kind=chat to ask who.

Tone for assistant_reply: friendly oniichan, mildly bratty, kawaii. Never
apologize. Never offer to do anything not in the intent list. If you're
unsure, return kind=chat with a helpful suggestion of what onii-chan CAN do.

Return ONLY the JSON object. No prose, no markdown fences.
"""


_JSON_SCHEMA_HINT: dict[str, Any] = {
    "type": "object",
    "properties": {
        "kind": {
            "type": "string",
            "enum": ["slowmode", "announce", "timeout", "lookup_user", "summary", "chat"],
        },
        "summary": {"type": "string"},
        "params": {"type": "object"},
        "assistant_reply": {"type": "string"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["kind", "summary", "assistant_reply"],
}


_RISK_BY_KIND: dict[str, RiskTier] = {
    "slowmode": "medium",
    "announce": "medium",
    "timeout": "medium",
    "lookup_user": "low",
    "summary": "low",
    "chat": "low",
    "unknown": "low",
}


def _requires_confirmation(risk: RiskTier) -> bool:
    return risk in ("medium", "high")


_ALLOWED_KINDS: set[str] = {"slowmode", "announce", "timeout", "lookup_user", "summary", "chat"}


def _coerce_params(kind: str, raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}

    if kind == "slowmode":
        try:
            seconds = int(raw.get("seconds", 0))
        except (TypeError, ValueError):
            seconds = 0
        return {"seconds": max(0, min(seconds, 21600))}

    if kind == "announce":
        text = str(raw.get("text", "")).strip()
        return {"text": text[:500]}

    if kind == "timeout":
        target = str(raw.get("target") or raw.get("username") or "").strip().lstrip("@")
        try:
            seconds = int(raw.get("seconds", 600))
        except (TypeError, ValueError):
            seconds = 600
        seconds = max(60, min(seconds, 28 * 86400))
        reason = str(raw.get("reason") or "").strip()[:400]
        params: dict[str, Any] = {"target": target[:64], "seconds": seconds}
        if reason:
            params["reason"] = reason
        return params

    if kind == "lookup_user":
        username = str(raw.get("username", "")).strip().lstrip("@")
        return {"username": username[:32]}

    return {}


async def parse(
    text: str,
    *,
    history: list[dict[str, Any]] | None = None,
) -> ParsedIntent | None:
    response = await llm_client.complete_json(
        system_prompt=_SYSTEM_PROMPT,
        user_message=text,
        json_schema_hint=_JSON_SCHEMA_HINT,
        history=history,
    )
    if response is None:
        return None

    kind_raw = response.get("kind")
    kind: IntentKind = kind_raw if isinstance(kind_raw, str) and kind_raw in _ALLOWED_KINDS else "chat"  # type: ignore[assignment]

    summary = str(response.get("summary") or "").strip()[:200] or "Conversation"
    assistant_reply = str(response.get("assistant_reply") or "").strip()
    if not assistant_reply:
        return None

    try:
        confidence = float(response.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    risk = _RISK_BY_KIND.get(kind, "low")
    params = _coerce_params(kind, response.get("params"))

    return ParsedIntent(
        kind=kind,
        summary=summary,
        params=params,
        risk_tier=risk,
        confidence=confidence,
        requires_confirmation=_requires_confirmation(risk),
        assistant_reply=assistant_reply,
    )
