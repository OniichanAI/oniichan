"""Heuristic regex intent parser. Always available, used as fallback.

Recognises a small grammar without an LLM. Same return shape as the LLM
parser, so they're interchangeable.
"""
from __future__ import annotations

import re

from app.services.intent_types import ParsedIntent


_SLOWMODE_PAT = re.compile(
    r"\b(?:enable\s+)?slowmode\b(?:\s+(?:to|for|of|with))?\s*(\d+)\s*(s|sec|secs|second|seconds|m|min|minute|minutes)?",
    re.IGNORECASE,
)
_DISABLE_SLOWMODE_PAT = re.compile(r"\b(?:disable|turn off|stop)\s+slowmode\b", re.IGNORECASE)
_ANNOUNCE_PAT = re.compile(r"\b(?:announce|broadcast|post)\s+(?:that\s+)?(.+)", re.IGNORECASE)
_LOOKUP_PAT = re.compile(r"\b(?:look\s*up|who\s+is|info\s+(?:on|about))\s+@?(\w[\w\-_.]{1,32})", re.IGNORECASE)
_SUMMARY_PAT = re.compile(r"\b(?:summary|status|overview|how(?:'s| is)\s+(?:the|my)\s+server|health)\b", re.IGNORECASE)
_TIMEOUT_PAT = re.compile(
    r"\b(?:timeout|mute|silence)\s+@?(\w[\w\-_.]{1,32})(?:\s+(?:for|in|of))?\s*(\d+)?\s*(s|sec|secs|second|seconds|m|min|minute|minutes|h|hr|hour|hours)?",
    re.IGNORECASE,
)
_KICK_PAT = re.compile(r"\b(?:kick|boot)\s+@?(\w[\w\-_.]{1,32})", re.IGNORECASE)
_BAN_PAT = re.compile(r"\bban\s+@?(\w[\w\-_.]{1,32})", re.IGNORECASE)
# "give @user the mod role" or "grant @user moderator role"
_ROLE_GIVE_PAT = re.compile(
    r"\b(?:give|grant|assign|add)\s+@?(\w[\w\-_.]{1,32})\s+(?:the\s+)?[`']?([\w\- ]{1,40}?)[`']?\s+role\b",
    re.IGNORECASE,
)
# "remove the mod role from @user" or "revoke moderator from @user"
_ROLE_TAKE_PAT = re.compile(
    r"\b(?:remove|revoke|take|strip)\s+(?:the\s+)?[`']?([\w\- ]{1,40}?)[`']?\s+(?:role\s+)?(?:from|off)\s+@?(\w[\w\-_.]{1,32})",
    re.IGNORECASE,
)


def _to_seconds(value: int, unit: str | None) -> int:
    if not unit:
        return value
    u = unit.lower()
    if u.startswith("h"):
        return value * 3600
    if u.startswith("m"):
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
        seconds = max(0, min(seconds, 21600))
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

    if (match := _TIMEOUT_PAT.search(cleaned)) is not None:
        target = match.group(1)
        raw_seconds = int(match.group(2)) if match.group(2) else 10
        # Bare digit defaults to minutes (people don't say "timeout for 5"
        # meaning 5 seconds). The "m" suffix is the same path.
        seconds = _to_seconds(raw_seconds, match.group(3) or "m")
        seconds = max(60, min(seconds, 28 * 86400))
        return ParsedIntent(
            kind="timeout",
            summary=f"Timeout {target} for {seconds // 60}m",
            params={"target": target, "seconds": seconds},
            risk_tier="medium",
            confidence=0.9,
            requires_confirmation=True,
            assistant_reply=(
                f"I'll time out @{target} for {seconds // 60} minute(s). Confirm to proceed."
            ),
        )

    if (match := _ROLE_GIVE_PAT.search(cleaned)) is not None:
        target, role = match.group(1), match.group(2).strip()
        return ParsedIntent(
            kind="role_assign",
            summary=f"Grant '{role}' to {target}",
            params={"target": target, "role": role},
            risk_tier="medium",
            confidence=0.9,
            requires_confirmation=True,
            assistant_reply=f"giving @{target} the `{role}` role. confirm?",
        )

    if (match := _ROLE_TAKE_PAT.search(cleaned)) is not None:
        role, target = match.group(1).strip(), match.group(2)
        return ParsedIntent(
            kind="role_remove",
            summary=f"Remove '{role}' from {target}",
            params={"target": target, "role": role},
            risk_tier="medium",
            confidence=0.9,
            requires_confirmation=True,
            assistant_reply=f"taking the `{role}` role off @{target}. confirm?",
        )

    if (match := _BAN_PAT.search(cleaned)) is not None:
        target = match.group(1)
        return ParsedIntent(
            kind="ban",
            summary=f"Ban {target}",
            params={"target": target, "purge_hours": 0},
            risk_tier="high",
            confidence=0.9,
            requires_confirmation=True,
            assistant_reply=(
                f"i'll ban @{target} permanently. double-check before confirming — "
                "this isn't easy to undo."
            ),
        )

    if (match := _KICK_PAT.search(cleaned)) is not None:
        target = match.group(1)
        return ParsedIntent(
            kind="kick",
            summary=f"Kick {target}",
            params={"target": target},
            risk_tier="high",
            confidence=0.9,
            requires_confirmation=True,
            assistant_reply=f"kicking @{target} out. they can rejoin if they have an invite. confirm?",
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
            "• `timeout @username for 10m`\n"
            "• `kick @username` / `ban @username`  (high-risk — needs Settings → cap=high)\n"
            "• `give @username the moderator role`\n"
            "• `remove the moderator role from @username`\n"
            "• `lookup @username`\n"
            "• `summary` — for a server health overview"
        ),
    )


# Re-export so callers can `from intent_parser_regex import ParsedIntent`.
__all__ = ["parse", "ParsedIntent"]
