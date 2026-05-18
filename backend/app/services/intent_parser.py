"""Intent-parsing facade.

Routes to one of:
  - JSON-mode LLM parser (default — works on every OpenAI-compat endpoint,
    best for small open-source models per our eval)
  - Tool-calling LLM parser (better on stronger models; opt-in via LLM_MODE)
  - Regex fallback (always available; fires when LLM is disabled or fails)

Importers should only use `parse()` / `parse_stream()` from this module. The
underlying impls are private to the package and can be swapped without
touching callers.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

from app.core.config import settings
from app.services import intent_parser_json, intent_parser_llm, intent_parser_regex
from app.services.intent_types import ParsedIntent  # re-exported


logger = logging.getLogger("app.intent")


async def parse(
    text: str,
    *,
    history: list[dict[str, Any]] | None = None,
) -> ParsedIntent:
    """Async to support the LLM paths. The regex path is sync but cheap.

    `history` is an optional list of prior `{role, content}` turns. Regex
    fallback ignores it (it's keyword-based) — the LLM paths use it for
    conversation context.
    """
    if settings.llm_api_key:
        if settings.llm_mode == "tools":
            llm_result = await intent_parser_llm.parse(text, history=history)
        else:
            llm_result = await intent_parser_json.parse(text, history=history)

        if llm_result is not None:
            return llm_result
        logger.info("LLM intent parse returned None; falling back to regex")

    return intent_parser_regex.parse(text)


async def parse_stream(
    text: str,
    *,
    history: list[dict[str, Any]] | None = None,
) -> AsyncIterator["intent_parser_llm.ParseStreamEvent"]:
    """Streaming intent parse. Only the tool-calling LLM path streams natively.

    Other modes (JSON, regex) are turned into a single-shot pseudo-stream:
    one `delta` containing the full assistant_reply, then `done` with the
    final ParsedIntent. The caller's SSE wire format stays uniform.
    """
    if settings.llm_api_key and settings.llm_mode == "tools":
        final_intent: ParsedIntent | None = None
        async for event in intent_parser_llm.parse_stream(text, history=history):
            if event.delta:
                yield event
            if event.done:
                final_intent = event.final
                if final_intent is not None:
                    yield event
                    return
                # LLM stream failed — fall through to regex below.
                logger.info("LLM stream returned no intent; falling back to regex")
                break

    # Non-streaming path (JSON mode or regex fallback): synthesize a single
    # delta + done so the SSE consumer doesn't have to special-case modes.
    if settings.llm_api_key and settings.llm_mode == "json":
        json_result = await intent_parser_json.parse(text, history=history)
        intent = json_result if json_result is not None else intent_parser_regex.parse(text)
    else:
        intent = intent_parser_regex.parse(text)

    yield intent_parser_llm.ParseStreamEvent(delta=intent.assistant_reply)
    yield intent_parser_llm.ParseStreamEvent(done=True, final=intent)


__all__ = ["parse", "parse_stream", "ParsedIntent"]
