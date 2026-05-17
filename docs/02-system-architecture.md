# 02 - System Architecture

## Architecture Style

Recommended phased approach:

1. Phase A (0-90 days): Modular monolith + workers
2. Phase B (growth): Split into focused microservices

Reason: team size is 2 and budget is 0 for first 3 months. A microservice-first start would increase complexity and delivery risk.

## High-Level Components

1. Angular Web App
2. FastAPI Core API (primary orchestrator)
3. Discord Gateway/REST Worker
4. AI Orchestrator (prompting, tool-routing, confidence scoring)
5. RAG Service (embeddings + retrieval)
6. Policy Engine (Python initially, Spring Boot optional in phase B)
7. Event + Audit Pipeline
8. PostgreSQL + pgvector
9. Redis (cache, queue, rate controls)
10. Object storage (local MinIO in dev, S3 later)

## Suggested Runtime Topology

```text
Browser (Angular)
  -> FastAPI API Gateway/Backend
      -> Auth Module (Discord OAuth)
      -> Chat Orchestrator
          -> Model Router (HF free inference)
          -> Policy Guard
          -> Tool Executor
              -> Discord API Client + Worker
      -> RAG Module (pgvector retrieval)
      -> Audit/Event Writer
  -> PostgreSQL (tenant, authz, audits, config, features, vector refs)
  -> Redis (sessions, rate limits, queue)
  -> MinIO/S3 (documents, exports)
```

## Tenant Isolation Model

1. Every request bound to `tenant_id`
2. All domain tables include `tenant_id`
3. Global query filters in data layer
4. Row-level security (RLS) when possible
5. Redis key namespaces include tenant prefix
6. Per-tenant encryption key strategy in future phase

## Service Boundaries (Target State)

1. `api-core` (FastAPI): auth, app APIs, orchestration
2. `discord-ops` (worker): gateway events, command execution
3. `ai-orchestrator` (FastAPI): inference routing + confidence scoring
4. `policy-engine` (Spring Boot optional): policy decisions, rule eval
5. `analytics` (batch): moderation summaries, scoring pipelines

## Why Add Spring Boot Later

Spring Boot fits well for:

1. Strong typed policy DSL execution
2. Complex rule lifecycle and validation
3. Enterprise integrations in future

Do not introduce it in first 4-6 weeks unless there is immediate policy complexity requiring Java ecosystem.

## Data Flow: Chat To Action

1. User sends message in web chat
2. API resolves actor identity + tenant context
3. AI orchestrator classifies intent and tool candidates
4. Policy guard checks actor permissions and action restrictions
5. If confidence or risk triggers threshold, ask for confirmation/clarification
6. Tool executor sends operation to Discord API
7. Result + evidence recorded in audit log
8. User receives structured receipt

## Event-Driven Layers

1. Discord inbound events are normalized into internal event schema
2. Events fed to moderation analytics and autonomy agents
3. Rule triggers generate recommended actions or autonomous decisions
4. All autonomous actions are logged with policy/rationale snapshot

## Availability and Resilience Recommendations

1. Retries with exponential backoff for Discord transient failures
2. Idempotency keys for high-risk operations
3. Dead-letter queue for failed action jobs
4. Circuit breaker when Discord rate limits spike
5. Safe degraded mode when LLM service is unavailable
