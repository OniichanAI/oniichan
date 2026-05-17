# 04 - Backend Guide (FastAPI)

## Role of FastAPI

FastAPI is the primary application backend for:

1. Auth and tenant session management
2. Web API for UI modules
3. Chat orchestration and tool execution
4. Policy checks and confidence controls
5. Audit logging and event emission

## Suggested Module Structure

```text
backend/
  app/
    api/
      v1/
        auth.py
        chat.py
        tenants.py
        moderation.py
        channels.py
        roles.py
        analytics.py
        settings.py
    core/
      config.py
      security.py
      dependencies.py
      logging.py
    domain/
      entities/
      services/
      policies/
    infra/
      db/
      redis/
      discord/
      llm/
      rag/
      queue/
    workers/
      moderation_worker.py
      discord_worker.py
      analytics_worker.py
```

## API Design Principles

1. Version all routes (`/api/v1`).
2. Use tenant-aware route guards.
3. Enforce strict request/response Pydantic schemas.
4. Return structured execution receipts for actions.
5. Include audit metadata in action responses.

## Chat Execution Pipeline

1. `POST /api/v1/chat/messages`
2. Validate actor session + tenant context
3. Build prompt envelope:
   - actor role
   - tenant policy
   - recent context
   - allowed tools
4. Route to model and parse tool calls
5. Validate tool schema and policy authorization
6. Handle confidence thresholds:
   - low: clarification question
   - medium/high risk: confirmation step
   - high confidence safe: execute
7. Execute via Discord adapter
8. Log immutable audit record
9. Return message + action receipt

## Required Background Jobs

1. Event ingestion from Discord gateway
2. Behavior score recomputation
3. Moderation summary generation
4. Retry queue for failed actions
5. Data retention cleanup jobs

Recommended queue stack:

1. Redis + RQ or Celery in early phase
2. Upgrade to Kafka/NATS only when throughput requires

## Configuration and Secrets

Use environment-based configuration:

1. `DISCORD_CLIENT_ID`
2. `DISCORD_CLIENT_SECRET`
3. `DISCORD_BOT_TOKEN` (per tenant stored encrypted)
4. `HF_API_KEY`
5. `DATABASE_URL`
6. `REDIS_URL`
7. `JWT_SECRET` / session signing keys

## API Endpoints (Initial)

1. `POST /auth/discord/login`
2. `GET /auth/discord/callback`
3. `POST /chat/messages`
4. `GET /chat/history`
5. `POST /actions/confirm`
6. `POST /moderation/slowmode/toggle`
7. `POST /moderation/user/sanction`
8. `POST /channels/bulk-create`
9. `POST /roles/map`
10. `GET /analytics/moderation-summary`
11. `GET /audit/events`

## Reliability Controls

1. Idempotency key header for mutating actions
2. Request deduplication for repeated prompts
3. Timeouts and cancellation propagation
4. Structured error taxonomy:
   - `CONFIDENCE_LOW`
   - `POLICY_DENIED`
   - `DISCORD_RATE_LIMITED`
   - `TOOL_VALIDATION_FAILED`
