#!/usr/bin/env bash
# End-to-end smoke. Brings up the full Docker stack (postgres + backend +
# frontend), waits for both ports, and runs the Playwright smoke spec.
set -euo pipefail

cd "$(dirname "$0")/../.."

cleanup() {
  echo "==> E2E: tearing down stack"
  docker compose --profile frontend logs backend frontend > .ci-stack.log 2>&1 || true
  docker compose --profile frontend down -v --remove-orphans || true
  # Only delete .env if we created it. A developer running this script
  # locally already has a real .env that we must not stomp.
  if [ -f backend/.env.ci ]; then
    rm -f backend/.env backend/.env.ci
  fi
}
trap cleanup EXIT

# docker-compose.yml uses `env_file: ./backend/.env` for the backend
# service. That file is gitignored (it holds real secrets in dev) so we
# synthesize a throwaway one for CI. Real Discord credentials aren't
# needed — the smoke test only exercises the redirect, not the round-trip.
if [ ! -f backend/.env ]; then
  cat > backend/.env <<'EOF'
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/discord_ops
SESSION_SIGNING_SECRET=e2e-secret-32-chars-long-enough-for-jwt-signing
DISCORD_CLIENT_ID=000000000000000000
DISCORD_CLIENT_SECRET=placeholder
DISCORD_BOT_TOKEN=
DISCORD_REDIRECT_URI=http://localhost:4200/auth/callback
LLM_API_KEY=
EOF
  # Marker so cleanup knows it can safely delete; a dev's local .env survives.
  touch backend/.env.ci
fi

echo "==> E2E: bringing up stack"
docker compose --profile frontend up -d --build postgres backend frontend

echo "==> E2E: waiting for backend (max 60s)"
for i in $(seq 1 30); do
  if curl -fs http://localhost:8000/api/v1/health > /dev/null; then
    echo "backend ready in ${i}*2s"
    break
  fi
  sleep 2
done

echo "==> E2E: waiting for frontend (max 60s)"
for i in $(seq 1 30); do
  if curl -fs http://localhost:4200 > /dev/null; then
    echo "frontend ready in ${i}*2s"
    break
  fi
  sleep 2
done

echo "==> E2E: running Playwright"
cd frontend
npx playwright install --with-deps chromium
npx playwright test
