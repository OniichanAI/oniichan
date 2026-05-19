"""Intent-parser eval runner.

    python -m eval.run_intent_eval [--label baseline-json]

Hits the in-process intent parser (whatever's configured via LLM_API_KEY) and
grades it against eval/intent_dataset.py. Outputs:

  - A per-case table to stdout (PASS / FAIL with the reason)
  - A summary block (% kind correct, % params correct, % valid, p95 latency)
  - A JSON file in eval/results/<label>-<timestamp>.json for later diff

Designed to be cheap-ish: ~35 model calls per run with small payloads.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Allow running as `python -m eval.run_intent_eval` from /app
if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import intent_parser, llm_client  # noqa: E402

from eval.intent_dataset import CASES, EvalCase  # noqa: E402


@dataclass
class CaseResult:
    prompt: str
    expected_kind: str
    expected_params: dict[str, Any]
    actual_kind: str
    actual_params: dict[str, Any]
    kind_ok: bool
    params_ok: bool
    valid_output: bool  # parser returned a non-empty assistant_reply
    latency_ms: float
    notes: str = ""


@dataclass
class RunSummary:
    label: str
    timestamp: str
    provider: str
    model: str | None
    total: int
    valid: int
    kind_correct: int
    params_correct: int
    end_to_end_correct: int
    p50_latency_ms: float
    p95_latency_ms: float
    cases: list[CaseResult] = field(default_factory=list)


def _params_subset_match(expected: dict[str, Any], actual: dict[str, Any]) -> bool:
    """Every expected key must be present in actual and equal.

    Numeric params (`seconds`) get a small fuzz so the model isn't penalized
    for picking 600 vs 605 when the prompt is genuinely ambiguous.
    """
    for key, want in expected.items():
        got = actual.get(key)
        if got is None:
            return False
        if isinstance(want, int) and isinstance(got, int):
            tolerance = max(5, int(want * 0.1))
            if abs(got - want) > tolerance:
                return False
        elif isinstance(want, str) and isinstance(got, str):
            if want.lower().strip().lstrip("@") != got.lower().strip().lstrip("@"):
                return False
        else:
            if want != got:
                return False
    return True


async def _run_case(case: EvalCase, *, regex_only: bool = False) -> CaseResult:
    started = time.perf_counter()
    if regex_only:
        from app.services import intent_parser_regex

        intent = intent_parser_regex.parse(case.prompt)
    else:
        intent = await intent_parser.parse(case.prompt)
    latency_ms = (time.perf_counter() - started) * 1000

    accepted_kinds = {case.expected_kind, *case.also_acceptable_kinds}
    kind_ok = intent.kind in accepted_kinds
    params_ok = _params_subset_match(case.expected_params, intent.params)
    valid_output = bool(intent.assistant_reply and intent.kind)

    return CaseResult(
        prompt=case.prompt,
        expected_kind=case.expected_kind,
        expected_params=dict(case.expected_params),
        actual_kind=intent.kind,
        actual_params=dict(intent.params),
        kind_ok=kind_ok,
        params_ok=params_ok,
        valid_output=valid_output,
        latency_ms=latency_ms,
        notes=case.notes,
    )


async def run(label: str, delay_s: float = 0.0, *, regex_only: bool = False) -> RunSummary:
    info = llm_client.info()
    provider = "regex" if regex_only else info.provider
    model = None if regex_only else info.model
    results: list[CaseResult] = []
    for i, case in enumerate(CASES, start=1):
        if i > 1 and delay_s > 0 and not regex_only:
            await asyncio.sleep(delay_s)
        result = await _run_case(case, regex_only=regex_only)
        status = "✓" if (result.kind_ok and result.params_ok) else "✗"
        print(
            f"[{i:>2}/{len(CASES)}] {status} kind={result.actual_kind:12s} "
            f"params={result.actual_params}  ({result.latency_ms:.0f}ms)  "
            f'"{result.prompt[:60]}"'
        )
        if not result.kind_ok:
            print(f"        expected kind={result.expected_kind} (or any of {case.also_acceptable_kinds})")
        if not result.params_ok and result.expected_params:
            print(f"        expected params subset {result.expected_params}")
        results.append(result)

    latencies = [r.latency_ms for r in results]
    summary = RunSummary(
        label=label,
        timestamp=datetime.now(UTC).isoformat(),
        provider=provider,
        model=model,
        total=len(results),
        valid=sum(1 for r in results if r.valid_output),
        kind_correct=sum(1 for r in results if r.kind_ok),
        params_correct=sum(1 for r in results if r.params_ok),
        end_to_end_correct=sum(1 for r in results if r.kind_ok and r.params_ok),
        p50_latency_ms=statistics.median(latencies),
        p95_latency_ms=statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies),
        cases=results,
    )
    return summary


def _print_summary(s: RunSummary) -> None:
    total = s.total or 1
    print()
    print(f"=== {s.label} ({s.provider} {s.model or ''}) ===")
    print(f"Cases:               {s.total}")
    print(f"Valid output:        {s.valid}/{s.total}  ({s.valid / total * 100:.1f}%)")
    print(f"Kind correct:        {s.kind_correct}/{s.total}  ({s.kind_correct / total * 100:.1f}%)")
    print(f"Params correct:      {s.params_correct}/{s.total}  ({s.params_correct / total * 100:.1f}%)")
    print(f"End-to-end correct:  {s.end_to_end_correct}/{s.total}  ({s.end_to_end_correct / total * 100:.1f}%)")
    print(f"Latency p50:         {s.p50_latency_ms:.0f}ms")
    print(f"Latency p95:         {s.p95_latency_ms:.0f}ms")


def _persist(s: RunSummary) -> Path:
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    ts = s.timestamp.replace(":", "-").replace(".", "-")
    path = out_dir / f"{s.label}-{ts}.json"
    path.write_text(json.dumps(asdict(s), indent=2))
    return path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", default="run", help="Tag for this run (filename + summary header)")
    parser.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Seconds to sleep between cases (use 2.5+ on Groq free tier to avoid TPM caps)",
    )
    parser.add_argument(
        "--regex-only",
        action="store_true",
        help="Skip the LLM and run the regex fallback only (used by CI as a fast baseline).",
    )
    parser.add_argument(
        "--min-pass-rate",
        type=float,
        default=None,
        help="Exit non-zero if end-to-end pass rate falls below this (0..1). CI uses this as a gate.",
    )
    args = parser.parse_args()

    summary = asyncio.run(run(args.label, delay_s=args.delay, regex_only=args.regex_only))
    _print_summary(summary)
    out_path = _persist(summary)
    print(f"\nSaved → {out_path.relative_to(Path.cwd()) if out_path.is_relative_to(Path.cwd()) else out_path}")

    pass_rate = summary.end_to_end_correct / max(summary.total, 1)
    if args.min_pass_rate is not None:
        if pass_rate < args.min_pass_rate:
            print(f"\nFAIL: end-to-end pass rate {pass_rate:.1%} below threshold {args.min_pass_rate:.1%}")
            return 1
        print(f"\nOK: pass rate {pass_rate:.1%} ≥ threshold {args.min_pass_rate:.1%}")
        return 0
    return 0 if summary.end_to_end_correct == summary.total else 1


if __name__ == "__main__":
    raise SystemExit(main())
