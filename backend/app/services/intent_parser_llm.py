"""LLM-backed intent parser using OpenAI-compatible tool calling.

Each Discord action is declared as a *tool* with a JSON-schema parameter
list; the model picks one (or none, in which case we treat the response as
plain chat). This buys us:

  - Tighter schema adherence on small open-source models
  - Native "I don't have enough info" behavior (the model returns text
    instead of forcing a tool call)
  - Trivially extensible to streaming + multi-tool turns later

Safety invariants — all enforced server-side, never trusted from the model:
  - Allowed-tool whitelist (anything else collapses to "chat")
  - Risk tier mapped from the tool name, not the model's word
  - Confirmation requirement derived from risk tier
  - Params coerced + clamped per tool
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.services import llm_client
from app.services.intent_types import IntentKind, ParsedIntent, RiskTier


_SYSTEM_PROMPT = """You are Oniichan, a Discord moderation assistant.

**You MUST call a tool when the user asks for an action.** The user is a
trusted server admin — they will confirm before anything actually runs.
Refusing to call a tool when the user clearly asked for one is a bug.

Decision rules (apply in order):

1. If the message contains any of: "slowmode", "slow mode", "timeout",
   "mute", "silence", "kick", "ban", "remove", "boot", "announce",
   "broadcast", "post to", "lookup", "who is", "info on", "summary",
   "status", "overview" — you MUST call the matching tool. Do not reply
   with chat.

2. If the user described a moderation action in their own words (e.g.
   "throttle the channel", "shut them up for an hour", "get rid of that
   guy", "show them the door for good", "tell everyone that…", "what do
   we know about user X") — call the matching tool.

3. Only reply without a tool call when:
   - The user is greeting you, asking what you can do, or making small talk
   - The user asked for something no tool covers (channels, categories,
     server settings, emojis, custom commands, anything not in the tool list)
   - The user gave a command but is missing required info — and ONLY then,
     ask a clarifying question

When the user *follows up* on a previous request (you'll see prior turns in
the conversation history), don't pretend it's a brand-new question. If the
follow-up gives you enough info to call a tool, call it. If not — and the
original request was for something you can't actually do — plainly explain
you don't have a tool for that yet in your normal voice. Don't dump the
full help list every turn; only when the user directly asks what you can do.

For tools that need a duration but the user didn't specify: pick a sensible
default (slowmode → 30, timeout → 600).

Voice (for both tool-accompanying text and chat replies): friendly oniichan,
mildly bratty, kawaii. Never apologize. Keep replies to 1–2 sentences. No
markdown.
"""


# ---- Tool descriptors. Each one becomes a callable function from the
# model's perspective. Tool name → ParsedIntent.kind directly.

_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "slowmode",
            "description": (
                "Set or disable a channel's slow-mode rate limit. Use seconds=0 "
                "to disable. Default channel is the server's system channel."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "seconds": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 21600,
                        "description": "Cooldown between messages (0 disables).",
                    },
                },
                "required": ["seconds"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "timeout",
            "description": (
                "Temporarily mute a user so they can't send messages. Discord "
                "auto-lifts the timeout when the duration passes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Username or display name of the member to time out.",
                    },
                    "seconds": {
                        "type": "integer",
                        "minimum": 60,
                        "maximum": 2419200,
                        "description": "Duration in seconds. Default 600 (10 minutes) if user didn't say.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Optional reason; shown in Discord's audit log.",
                    },
                },
                "required": ["target", "seconds"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "announce",
            "description": "Post an announcement message in the server's system channel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Message body to post. Max 500 chars.",
                    },
                },
                "required": ["text"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "kick",
            "description": (
                "DESTRUCTIVE: remove a user from the server. They can rejoin "
                "via any invite they still have. High risk — only call when "
                "the user has clearly asked to kick someone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Username or display name of the member to kick.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Optional reason; shown in Discord's audit log.",
                    },
                },
                "required": ["target"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ban",
            "description": (
                "DESTRUCTIVE: ban a user from the server (permanent unless "
                "manually unbanned). Optionally deletes their recent messages. "
                "High risk — only call when the user has clearly asked to ban."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "Username or display name of the member to ban.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Optional reason; shown in Discord's audit log.",
                    },
                    "purge_hours": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 168,
                        "description": (
                            "Hours of the user's recent messages to also delete "
                            "(0 = keep messages, max 168 = 7 days)."
                        ),
                    },
                },
                "required": ["target"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "role_assign",
            "description": (
                "Grant a server role to a member. Reversible by role_remove — medium risk."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Member username/display name."},
                    "role": {"type": "string", "description": "Role name (case-insensitive)."},
                    "reason": {"type": "string", "description": "Optional reason for the audit log."},
                },
                "required": ["target", "role"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "role_remove",
            "description": "Revoke a server role from a member. Medium risk.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Member username/display name."},
                    "role": {"type": "string", "description": "Role name (case-insensitive)."},
                    "reason": {"type": "string", "description": "Optional reason for the audit log."},
                },
                "required": ["target", "role"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_user",
            "description": "Get info / recent activity about a server member by username.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "Username (with or without @) to look up.",
                    },
                },
                "required": ["username"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summary",
            "description": "Describe overall server health: member count, channels, recent moderation activity.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
]


# Same safety map as before — model can't change these.
_RISK_BY_KIND: dict[str, RiskTier] = {
    "slowmode": "medium",
    "announce": "medium",
    "timeout": "medium",
    "role_assign": "medium",
    "role_remove": "medium",
    "kick": "high",
    "ban": "high",
    "lookup_user": "low",
    "summary": "low",
    "chat": "low",
    "unknown": "low",
}


def _requires_confirmation(risk: RiskTier) -> bool:
    return risk in ("medium", "high")


_ALLOWED_KINDS: set[str] = {
    "slowmode",
    "announce",
    "timeout",
    "kick",
    "ban",
    "role_assign",
    "role_remove",
    "lookup_user",
    "summary",
    "chat",
}


def _coerce_params(kind: str, raw: Any) -> dict[str, Any]:
    """Strip + bound params so a hallucinated extra field never reaches the
    executor. Same coercion the JSON-mode path used — moving here unchanged.
    """
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
        out: dict[str, Any] = {"target": target[:64], "seconds": seconds}
        if reason:
            out["reason"] = reason
        return out

    if kind == "kick":
        target = str(raw.get("target") or raw.get("username") or "").strip().lstrip("@")
        reason = str(raw.get("reason") or "").strip()[:400]
        out_k: dict[str, Any] = {"target": target[:64]}
        if reason:
            out_k["reason"] = reason
        return out_k

    if kind == "ban":
        target = str(raw.get("target") or raw.get("username") or "").strip().lstrip("@")
        reason = str(raw.get("reason") or "").strip()[:400]
        try:
            purge_hours = int(raw.get("purge_hours", 0))
        except (TypeError, ValueError):
            purge_hours = 0
        purge_hours = max(0, min(purge_hours, 168))
        out_b: dict[str, Any] = {"target": target[:64], "purge_hours": purge_hours}
        if reason:
            out_b["reason"] = reason
        return out_b

    if kind in ("role_assign", "role_remove"):
        target = str(raw.get("target") or raw.get("username") or "").strip().lstrip("@")
        role = str(raw.get("role") or "").strip().lstrip("@")
        reason = str(raw.get("reason") or "").strip()[:400]
        out_r: dict[str, Any] = {"target": target[:64], "role": role[:100]}
        if reason:
            out_r["reason"] = reason
        return out_r

    if kind == "lookup_user":
        username = str(raw.get("username", "")).strip().lstrip("@")
        return {"username": username[:32]}

    return {}


# Hand-written assistant_reply templates used when the model emitted a tool
# call without any accompanying free-form content. Tool-calling lets the
# model do both (`tool_calls` + `content`), but not every provider/model
# returns both reliably. Templates keep the brand voice consistent either way.
def _template_reply(kind: str, params: dict[str, Any]) -> str:
    if kind == "slowmode":
        s = int(params.get("seconds", 0))
        if s == 0:
            return "okay onii-chan, turning slow mode off in this channel. confirm?"
        return f"got it — slow mode → {s}s in this channel. confirm and i'll do it~"
    if kind == "announce":
        text = str(params.get("text", "")).strip()
        preview = (text[:60] + "…") if len(text) > 60 else text
        return f'on it — posting: "{preview}". confirm to send.'
    if kind == "timeout":
        target = params.get("target", "someone")
        minutes = max(1, int(params.get("seconds", 600)) // 60)
        return f"okay, timeout @{target} for {minutes} min. confirm and they're cooked~"
    if kind == "kick":
        target = params.get("target", "someone")
        return f"kicking @{target} out of the server. you sure, onii-chan? confirm to send them packing."
    if kind == "ban":
        target = params.get("target", "someone")
        purge = int(params.get("purge_hours", 0))
        purge_note = f" (and wiping their last {purge}h of messages)" if purge else ""
        return f"banning @{target}{purge_note}. permanent — double-check before confirming!"
    if kind == "role_assign":
        return f"giving @{params.get('target', 'them')} the `{params.get('role', '?')}` role. confirm?"
    if kind == "role_remove":
        return f"taking the `{params.get('role', '?')}` role away from @{params.get('target', 'them')}. confirm?"
    if kind == "lookup_user":
        return f"poking around for @{params.get('username', 'them')}~"
    if kind == "summary":
        return "running a quick health check on your server, hold on..."
    return "i didn't catch that — try `enable slowmode 30s` or `summary`."


def _summary(kind: str, params: dict[str, Any]) -> str:
    if kind == "slowmode":
        s = int(params.get("seconds", 0))
        return "Disable slow mode" if s == 0 else f"Set slow mode to {s}s"
    if kind == "announce":
        text = str(params.get("text", "")).strip()
        return f"Announce: {text[:60]}{'…' if len(text) > 60 else ''}"
    if kind == "timeout":
        return f"Timeout {params.get('target', '?')} for {int(params.get('seconds', 0)) // 60}m"
    if kind == "kick":
        return f"Kick {params.get('target', '?')}"
    if kind == "ban":
        purge = int(params.get("purge_hours", 0))
        return f"Ban {params.get('target', '?')}" + (f" + purge {purge}h" if purge else "")
    if kind == "role_assign":
        return f"Grant '{params.get('role', '?')}' to {params.get('target', '?')}"
    if kind == "role_remove":
        return f"Remove '{params.get('role', '?')}' from {params.get('target', '?')}"
    if kind == "lookup_user":
        return f"Lookup {params.get('username', '?')}"
    if kind == "summary":
        return "Server summary"
    return "conversation"


def _response_to_intent(response: llm_client.ToolResponse) -> ParsedIntent | None:
    """Translate the raw tool-call response into a safety-validated ParsedIntent.

    Shared by the streaming + non-streaming paths so the safety rules
    (whitelist, risk mapping, coercion) only live in one place.
    """
    if not response.tool_calls:
        reply = response.content.strip()
        if not reply:
            return None
        return ParsedIntent(
            kind="chat",
            summary="conversation",
            params={},
            risk_tier="low",
            confidence=0.7,
            requires_confirmation=False,
            assistant_reply=reply,
        )

    call = response.tool_calls[0]
    kind: IntentKind = call.name if call.name in _ALLOWED_KINDS else "chat"  # type: ignore[assignment]
    params = _coerce_params(kind, call.arguments)
    risk = _RISK_BY_KIND.get(kind, "low")
    reply = response.content.strip() or _template_reply(kind, params)

    return ParsedIntent(
        kind=kind,
        summary=_summary(kind, params),
        params=params,
        risk_tier=risk,
        confidence=1.0,  # native tool-call → schema-valid by construction
        requires_confirmation=_requires_confirmation(risk),
        assistant_reply=reply,
    )


async def parse(
    text: str,
    *,
    history: list[dict[str, Any]] | None = None,
) -> ParsedIntent | None:
    """Returns ParsedIntent on success, None on any failure (caller falls
    back to the regex parser).

    `history` (optional) is prior {role, content} turns — gives the model
    conversation context so it doesn't repeat the help list every turn.
    """
    response = await llm_client.complete_with_tools(
        system_prompt=_SYSTEM_PROMPT,
        user_message=text,
        tools=_TOOLS,
        history=history,
    )
    if response is None:
        return None
    return _response_to_intent(response)


@dataclass
class ParseStreamEvent:
    """Surfaced to the SSE endpoint while streaming.

    Exactly one of `delta` / `final` is set per event. Final event has
    `done=True`; `final` may be None if the LLM stream failed and the
    caller should fall back to the regex parser.
    """

    delta: str = ""
    done: bool = False
    final: ParsedIntent | None = None


async def parse_stream(
    text: str,
    *,
    history: list[dict[str, Any]] | None = None,
) -> AsyncIterator[ParseStreamEvent]:
    """Async generator: yields token deltas, ends with the assembled intent.

    Lives alongside `parse()` so we never split the safety logic across
    paths. The dispatcher's gate, coercion, and templates apply identically
    here via `_response_to_intent`.
    """
    final_response: llm_client.ToolResponse | None = None
    async for event in llm_client.complete_with_tools_stream(
        system_prompt=_SYSTEM_PROMPT,
        user_message=text,
        tools=_TOOLS,
        history=history,
    ):
        if event.content_delta:
            yield ParseStreamEvent(delta=event.content_delta)
        if event.done:
            final_response = event.final
            break

    if final_response is None:
        yield ParseStreamEvent(done=True, final=None)
        return

    intent = _response_to_intent(final_response)
    yield ParseStreamEvent(done=True, final=intent)
