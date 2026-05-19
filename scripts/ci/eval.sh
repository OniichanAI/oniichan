#!/usr/bin/env bash
# Regex-only baseline of the intent eval. Runs without an LLM key so it's
# safe + free + deterministic in CI. Threshold mirrors what the regex parser
# currently achieves on the 47-case dataset — drop it if a real regression
# fires, don't bump it casually.
set -euo pipefail

cd "$(dirname "$0")/../../backend"

# The runner imports settings, which requires SESSION_SIGNING_SECRET. The eval
# itself never signs anything, but the global import chain pulls in config.
export SESSION_SIGNING_SECRET="${SESSION_SIGNING_SECRET:-eval-script-secret-32-chars-min}"
export LLM_API_KEY=""

echo "==> Eval: regex baseline"
python -m eval.run_intent_eval --label ci-regex --regex-only --min-pass-rate 0.40
