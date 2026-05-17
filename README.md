# AI Discord Ops Assistant

This repository now contains both planning docs and implementation foundations.

## Monorepo Structure

1. `backend/` - FastAPI service, Discord OAuth scaffold, tenant-aware schema, Alembic migrations
2. `frontend/` - Angular workspace target folder and bootstrap instructions
3. `infra/` - setup scripts (Angular bootstrap, infra helpers)
4. `docs/` - full implementation documentation set
5. `knowledge-bank/` - multi-page interactive HTML knowledge bank

## Quick Start

1. Copy env:
   - `cp backend/.env.example backend/.env`
2. Start local stack:
   - `docker compose up --build`
3. API:
   - `http://localhost:8000/docs`
4. If Angular app not scaffolded yet:
   - `./infra/scripts/init-angular.sh`

## Foundation Delivered

1. Docker Compose stack: Postgres, Redis, MinIO, FastAPI, Frontend runner
2. Discord OAuth endpoints:
   - `GET /api/v1/auth/discord/login`
   - `GET /api/v1/auth/discord/bot-install-url`
   - `GET /api/v1/auth/discord/callback`
3. Tenant-aware schema and migration baseline:
   - tenants, users, role bindings, guilds, bot credentials, audit events