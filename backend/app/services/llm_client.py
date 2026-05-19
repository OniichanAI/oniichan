"""Provider-agnostic LLM client.

Speaks the OpenAI-compatible Chat Completions schema (POST /chat/completions
with {model, messages, response_format, max_tokens, temperature}). Everything
that matters speaks this schema today: OpenAI, OpenRouter, Groq, Together,
Mistral, Fireworks, DeepInfra, vLLM, Ollama, llama.cpp, LM Studio, etc.

The shape is identical, the *base URL* and *model name* are what changes —
which is why all those live in settings, not in code.

Design rules:
  - Never raise from the hot path. Network errors / timeouts / bad JSON all
    collapse to None, and the caller (intent parser) falls back to regex.
  - Strict JSON output via response_format. If the provider doesn't honour
    that hint (some open-source endpoints don't), we still json.loads() the
    content and the caller validates the shape.
  - Stateless. No retries, no streaming. Intent classification is one shot.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings


logger = logging.getLogger("app.llm")


@dataclass(frozen=True)
class LLMInfo:
    """Public-facing description of the active LLM, surfaced to the frontend."""

    enabled: bool
    provider: str
    model: str | None


def info() -> LLMInfo:
    return LLMInfo(
        enabled=bool(settings.llm_api_key),
        provider=settings.llm_provider if settings.llm_api_key else "regex",
        model=settings.llm_model if settings.llm_api_key else None,
    )


async def complete_json(
    *,
    system_prompt: str,
    user_message: str,
    json_schema_hint: dict[str, Any] | None = None,
    history: list[dict[str, Any]] | None = None,
    temperature: float = 0.0,
) -> dict[str, Any] | None:
    """Single-shot chat completion expected to return a JSON object.

    Returns the parsed JSON dict on success, None on any failure (network,
    timeout, non-2xx, malformed JSON). Callers must treat None as "fall back".
    """
    if not settings.llm_api_key:
        return None

    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }

    # Inline the JSON schema hint into the system prompt so non-OpenAI
    # endpoints that ignore response_format still see the contract.
    schema_blob = ""
    if json_schema_hint is not None:
        schema_blob = (
            "\n\nReturn STRICT JSON only, matching this schema:\n"
            + json.dumps(json_schema_hint, indent=2)
        )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt + schema_blob}
    ]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "temperature": temperature,
        "max_tokens": settings.llm_max_tokens,
        "response_format": {"type": "json_object"},
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException:
        logger.warning("LLM call timed out after %ss", settings.llm_timeout_seconds)
        return None
    except httpx.HTTPError as exc:
        logger.warning("LLM transport error: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning(
            "LLM non-200 status=%d body=%s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        body = response.json()
        content = body["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError) as exc:
        logger.warning("LLM response had no usable content: %s", exc)
        return None

    if not isinstance(content, str):
        return None

    # Be tolerant: some providers wrap JSON in markdown fences even when asked not to.
    content = content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        # Strip a leading "json\n" if it remained from the fence header.
        if content.lower().startswith("json"):
            content = content[4:].lstrip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.warning("LLM returned non-JSON content: %s", exc)
        return None

    if not isinstance(parsed, dict):
        return None
    return parsed


# ---------- Tool-calling path ----------
#
# OpenAI-compatible function/tool calling. Used by intent_parser_llm when we
# want the model to pick one of a fixed set of operations rather than emit
# free-form JSON. Better adherence on small open-source models, native
# refuse-when-uncertain behavior, and trivially extensible to streaming /
# multi-tool later.

@dataclass(frozen=True)
class ToolCall:
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class ToolResponse:
    """What an OpenAI-compatible tool-call completion returns.

    `content` is the assistant's free-form text (may be empty when the model
    only emitted a tool call). `tool_calls` is zero or more structured calls.
    """

    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)


async def complete_with_tools(
    *,
    system_prompt: str,
    user_message: str,
    tools: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] = "auto",
    temperature: float = 0.0,
) -> ToolResponse | None:
    """Single-shot chat completion with tool-calling enabled.

    `history` (optional) is a list of prior messages in OpenAI-compatible
    shape — `{"role": "user"|"assistant", "content": str}`. They're inserted
    between the system prompt and the current user_message so the model has
    conversation context.

    Returns ToolResponse on success, None on network/transport/parse errors.
    """
    if not settings.llm_api_key:
        return None

    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "temperature": temperature,
        "max_tokens": settings.llm_max_tokens,
        "tools": tools,
        "tool_choice": tool_choice,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException:
        logger.warning("LLM (tools) timed out after %ss", settings.llm_timeout_seconds)
        return None
    except httpx.HTTPError as exc:
        logger.warning("LLM (tools) transport error: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning(
            "LLM (tools) non-200 status=%d body=%s",
            response.status_code,
            response.text[:300],
        )
        return None

    try:
        body = response.json()
        message = body["choices"][0]["message"]
    except (ValueError, KeyError, IndexError) as exc:
        logger.warning("LLM (tools) response missing message: %s", exc)
        return None

    content = message.get("content") or ""
    if not isinstance(content, str):
        content = ""

    raw_calls = message.get("tool_calls") or []
    calls: list[ToolCall] = []
    for raw in raw_calls:
        try:
            fn = raw.get("function") or {}
            name = fn.get("name")
            args_raw = fn.get("arguments")
            if not isinstance(name, str):
                continue
            # arguments comes back as a JSON-encoded string from OpenAI-compat;
            # some providers return a dict directly. Handle both.
            if isinstance(args_raw, str):
                try:
                    args = json.loads(args_raw or "{}")
                except json.JSONDecodeError:
                    args = {}
            elif isinstance(args_raw, dict):
                args = args_raw
            else:
                args = {}
            if not isinstance(args, dict):
                args = {}
            calls.append(ToolCall(name=name, arguments=args))
        except Exception as exc:  # noqa: BLE001 — tolerate provider quirks
            logger.warning("Malformed tool_call ignored: %s", exc)

    return ToolResponse(content=content.strip(), tool_calls=calls)


# ---------- Streaming tool-call path ----------


@dataclass
class StreamEvent:
    """One token-time event surfaced to the caller while streaming.

    Exactly one of `content_delta` / `tool_call_delta` is set per event;
    the final event is `done=True` with the assembled `final` ToolResponse.
    """

    content_delta: str = ""
    done: bool = False
    final: ToolResponse | None = None


async def complete_with_tools_stream(
    *,
    system_prompt: str,
    user_message: str,
    tools: list[dict[str, Any]],
    history: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] = "auto",
    temperature: float = 0.0,
) -> AsyncIterator[StreamEvent]:
    """Stream a tool-aware chat completion.

    Yields content tokens as they arrive (so the UI can render token-by-token),
    accumulates tool-call argument deltas server-side (they're only useful as
    a whole), and emits a final `done` event with the assembled response.

    Failure semantics: if anything goes wrong we yield a `done` event with
    `final=None` and stop. The caller falls back to the regex parser the same
    way the non-streaming path does.
    """
    if not settings.llm_api_key:
        yield StreamEvent(done=True, final=None)
        return

    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    payload: dict[str, Any] = {
        "model": settings.llm_model,
        "temperature": temperature,
        "max_tokens": settings.llm_max_tokens,
        "tools": tools,
        "tool_choice": tool_choice,
        "stream": True,
        "messages": messages,
    }

    content_buf: list[str] = []
    # tool_call_idx -> {"name": str, "args_buf": list[str]}
    tool_accum: dict[int, dict[str, Any]] = {}

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    body_preview = (await response.aread()).decode("utf-8", errors="replace")[:300]
                    logger.warning(
                        "LLM stream non-200 status=%d body=%s", response.status_code, body_preview
                    )
                    yield StreamEvent(done=True, final=None)
                    return

                async for raw_line in response.aiter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        continue
                    data = raw_line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    try:
                        delta = chunk["choices"][0]["delta"]
                    except (KeyError, IndexError):
                        continue

                    # Content tokens — yield as they arrive.
                    if isinstance(delta.get("content"), str) and delta["content"]:
                        content_buf.append(delta["content"])
                        yield StreamEvent(content_delta=delta["content"])

                    # Tool-call deltas — accumulate; surface only at the end.
                    for tc in delta.get("tool_calls") or []:
                        idx = tc.get("index", 0)
                        slot = tool_accum.setdefault(idx, {"name": None, "args_buf": []})
                        fn = tc.get("function") or {}
                        if isinstance(fn.get("name"), str) and fn["name"]:
                            slot["name"] = fn["name"]
                        if isinstance(fn.get("arguments"), str):
                            slot["args_buf"].append(fn["arguments"])

    except httpx.TimeoutException:
        logger.warning("LLM stream timed out after %ss", settings.llm_timeout_seconds)
        yield StreamEvent(done=True, final=None)
        return
    except httpx.HTTPError as exc:
        logger.warning("LLM stream transport error: %s", exc)
        yield StreamEvent(done=True, final=None)
        return

    # Assemble final ToolResponse from accumulated state.
    final_calls: list[ToolCall] = []
    for idx in sorted(tool_accum):
        slot = tool_accum[idx]
        if not slot["name"]:
            continue
        args_str = "".join(slot["args_buf"]) or "{}"
        try:
            args = json.loads(args_str)
        except json.JSONDecodeError:
            args = {}
        if not isinstance(args, dict):
            args = {}
        final_calls.append(ToolCall(name=slot["name"], arguments=args))

    final = ToolResponse(content="".join(content_buf).strip(), tool_calls=final_calls)
    yield StreamEvent(done=True, final=final)
