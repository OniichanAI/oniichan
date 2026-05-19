#!/usr/bin/env bash
# Frontend unit tests + production build. Browser-less; no Docker required.
set -euo pipefail

cd "$(dirname "$0")/../../frontend"

echo "==> Frontend: install"
npm ci --no-audit --no-fund

echo "==> Frontend: unit tests"
npm test

echo "==> Frontend: build (production)"
npm run build -- --configuration production
