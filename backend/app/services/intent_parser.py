"""Heuristic intent parser for ChatOps v0.

Recognizes a small grammar of moderation commands without an LLM. The shape is
deliberately the same as what an LLM tool-call response would look like
(intent + params + confidence + risk_tier), so swapping this for a real model
is a one-file change.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal


RiskTier = Literal["low", "medium", "high"]


@dataclass
class ParsedIntent:
    kind: str  # "chat" | "slowmode" | "announce" | "lookup_user" | "summary" | "unknown"
    summary: str
    params: dict[str, Any] = field(default_factory=dict)
    risk_tier: RiskTier = "low"
    confidence: float = 0.0
    requires_confirmation: bool = False
    assistant_reply: str = ""


_SLOWMODE_PAT = re.compile(
    r"\b(?:enable\s+)?slowmode\b(?:\s+(?:to|for|of|with))?\s*(\d+)\s*(s|sec|secs|second|seconds|m|min|minute|minutes)?",
    re.IGNORECASE,
)
_DISABLE_SLOWMODE_PAT = re.compile(r"\b(?:disable|turn off|stop)\s+slowmode\b", re.IGNORECASE)
_ANNOUNCE_PAT = re.compile(r"\b(?:announce|broadcast|post)\s+(?:that\s+)?(.+)", re.IGNORECASE)
_LOOKUP_PAT = re.compile(r"\b(?:look\s*up|who\s+is|info\s+(?:on|about))\s+@?(\w[\w\-_.]{1,32})", re.IGNORECASE)
_SUMMARY_PAT = re.compile(r"\b(?:summary|status|overview|how(?:'s| is)\s+(?:the|my)\s+server|health)\b", re.IGNORECASE)


def _to_seconds(value: int, unit: str | None) -> int:
    if unit and unit.lower().startswith("m"):
        return value * 60
    return value


def parse(text: str) -> ParsedIntent:
    cleaned = text.strip()
    if not cleaned:
        return ParsedIntent(
            kind="unknown",
            summary="empty input",
            assistant_reply="I didn't catch that — try `enable slowmode 10s` or `summary`.",
            confidence=1.0,
        )

    if _DISABLE_SLOWMODE_PAT.search(cleaned):
        return ParsedIntent(
            kind="slowmode",
            summary="Disable slow mode",
            params={"seconds": 0},
            risk_tier="medium",
            confidence=0.95,
            requires_confirmation=True,
            assistant_reply="I'll turn off slow mode in the current channel. Confirm to proceed.",
        )

    if (match := _SLOWMODE_PAT.search(cleaned)) is not None:
        seconds = _to_seconds(int(match.group(1)), match.group(2))
        seconds = max(0, min(seconds, 21600))  # Discord's hard cap
        return ParsedIntent(
            kind="slowmode",
            summary=f"Set slow mode to {seconds}s",
            params={"seconds": seconds},
            risk_tier="medium",
            confidence=0.95,
            requires_confirmation=True,
            assistant_reply=(
                f"I'll set slow mode to {seconds} seconds in the current channel. Confirm to proceed."
            ),
        )

    if (match := _ANNOUNCE_PAT.search(cleaned)) is not None:
        body = match.group(1).strip().strip(".")
        return ParsedIntent(
            kind="announce",
            summary=f"Announce: {body[:60]}{'…' if len(body) > 60 else ''}",
            params={"text": body},
            risk_tier="medium",
            confidence=0.85,
            requires_confirmation=True,
            assistant_reply=f'I\'ll post the following announcement: "{body}". Confirm to send.',
        )

    if (match := _LOOKUP_PAT.search(cleaned)) is not None:
        target = match.group(1)
        return ParsedIntent(
            kind="lookup_user",
            summary=f"Lookup {target}",
            params={"username": target},
            risk_tier="low",
            confidence=0.7,
            requires_confirmation=False,
            assistant_reply=(
                f"User lookup isn't wired to Discord yet — I'd normally show recent activity and "
                f"audit history for @{target}."
            ),
        )

    if _SUMMARY_PAT.search(cleaned):
        return ParsedIntent(
            kind="summary",
            summary="Server summary",
            risk_tier="low",
            confidence=0.8,
            requires_confirmation=False,
            assistant_reply=(
                "Open the Dashboard or Moderation pages for the current snapshot — "
                "member count, channels, and recent audit activity are pulled live from Discord."
            ),
        )

    return ParsedIntent(
        kind="chat",
        summary="conversation",
        risk_tier="low",
        confidence=0.3,
        requires_confirmation=False,
        assistant_reply=(
            "I can run safe moderation commands like:\n"
            "• `enable slowmode 30s`\n"
            "• `disable slowmode`\n"
            "• `announce server maintenance at 8pm`\n"
            "• `lookup @username`\n"
            "• `summary` — for a server health overview"
        ),
    )
