#!/usr/bin/env bash
# Backend unit + integration tests. Expects Postgres reachable via DATABASE_URL.
# The same script runs locally (inside the dev container) and in CI.
set -euo pipefail

cd "$(dirname "$0")/../../backend"

: "${DATABASE_URL:?DATABASE_URL must be set (test DB)}"
: "${SESSION_SIGNING_SECRET:=test-secret-32-chars-long-enough-for-jwt}"
export SESSION_SIGNING_SECRET

# Force LLM off so no API key is ever required for the test suite.
export LLM_API_KEY=""

echo "==> Backend: pytest"
pytest -q "$@"
