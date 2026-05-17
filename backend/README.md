# Backend Foundation (FastAPI)

## Run locally (without Docker)

1. Create environment and install dependencies:
   - `python -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
2. Copy env:
   - `cp .env.example .env`
3. Run migrations:
   - `alembic upgrade head`
4. Start API:
   - `uvicorn app.main:app --reload --port 8000`

## Key endpoints

- `GET /api/v1/health`
- `GET /api/v1/auth/discord/login`
- `GET /api/v1/auth/discord/bot-install-url`
- `GET /api/v1/auth/discord/callback`
- `POST /api/v1/tenants`
- `GET /api/v1/tenants/me` (requires `x-tenant-id` header)
