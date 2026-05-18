"""Shared types for intent parsing. Both regex + LLM implementations import
this and return the same shape."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


RiskTier = Literal["low", "medium", "high"]
IntentKind = Literal["chat", "slowmode", "announce", "lookup_user", "summary", "unknown"]


@dataclass
class ParsedIntent:
    kind: str  # IntentKind, but kept open-typed so unexpected LLM output doesn't crash
    summary: str
    params: dict[str, Any] = field(default_factory=dict)
    risk_tier: RiskTier = "low"
    confidence: float = 0.0
    requires_confirmation: bool = False
    assistant_reply: str = ""
