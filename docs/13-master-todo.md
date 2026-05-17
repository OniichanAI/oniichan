# 13 - Master TODO (Start to Finish)

Use this as the operational execution checklist.

## A. Project Setup

- [ ] Initialize mono-repo structure (`backend`, `frontend`, `infra`, `docs`, `knowledge-bank`)
- [ ] Configure Python + Node toolchains
- [ ] Add pre-commit checks (lint/format)
- [ ] Add Docker Compose for local stack
- [ ] Define branch and PR conventions

## B. Discord Platform Setup

- [ ] Create Discord application and bot
- [ ] Configure OAuth scopes and callback URLs
- [ ] Configure required intents
- [ ] Implement bot invite/install flow
- [ ] Implement post-install health verification

## C. Backend Foundation (FastAPI)

- [ ] Setup FastAPI project skeleton
- [ ] Setup config and secret management
- [ ] Implement auth module (Discord OAuth callback flow)
- [ ] Implement tenant context middleware
- [ ] Add structured logging and correlation IDs
- [ ] Create baseline domain models

## D. Database and Caching

- [ ] Stand up PostgreSQL + `pgvector`
- [ ] Stand up Redis
- [ ] Create migration pipeline
- [ ] Implement tenant-aware repositories
- [ ] Add audit append-only schema
- [ ] Add backup/restore scripts

## E. AI Orchestration

- [ ] Define system prompts and tool schemas
- [ ] Implement intent classification route
- [ ] Implement model router abstraction
- [ ] Implement confidence scoring and thresholds
- [ ] Implement low-confidence clarification flow
- [ ] Add prompt regression harness

## F. Tool Execution and Safety

- [ ] Build Discord action adapters
- [ ] Add policy checks before execution
- [ ] Add confirmation workflow for risky actions
- [ ] Add idempotency and retry logic
- [ ] Add kill switch and autonomy caps
- [ ] Add protected entities support

## G. RAG and Knowledge

- [ ] Define owner-only knowledge management
- [ ] Implement document ingestion and chunking
- [ ] Generate embeddings and store with tenant metadata
- [ ] Build retrieval with citations
- [ ] Add reindex button and freshness indicators

## H. Moderation Intelligence

- [ ] Ingest moderation and message events
- [ ] Define behavior scoring formula v1
- [ ] Implement daily summary generation
- [ ] Implement moderator consistency insights
- [ ] Implement anomaly and risk highlights

## I. Frontend Foundation (Angular + Tailwind)

- [ ] Initialize Angular app and Tailwind
- [ ] Add routing shell and auth guards
- [ ] Add global state and API clients
- [ ] Build login/onboarding flow
- [ ] Build reusable UI components and status badges

## J. Frontend Features

- [ ] ChatOps console with response streaming
- [ ] Action preview and confirmation cards
- [ ] Moderation dashboard
- [ ] Channel and role management UI
- [ ] Autonomy settings panel
- [ ] Audit explorer UI

## K. DevOps and CI/CD

- [ ] Setup GitHub Actions CI
- [ ] Add lint/unit/integration pipelines
- [ ] Add container build steps
- [ ] Configure dev/staging/prod environment separation
- [ ] Add feature flag management

## L. Observability and Ops

- [ ] Add OpenTelemetry instrumentation
- [ ] Add metrics dashboard (latency/errors/tool success)
- [ ] Add log aggregation and alerting
- [ ] Add on-call runbook and incident template

## M. Testing and Release

- [ ] Complete unit and integration coverage for critical paths
- [ ] Complete Discord staging server smoke tests
- [ ] Complete AI safety test matrix
- [ ] Run load tests for expected concurrency
- [ ] Final launch checklist sign-off

## N. Post-Launch Improvements

- [ ] A/B prompt testing
- [ ] Fine-tuning or LoRA evaluation plan
- [ ] Optional Spring Boot policy service extraction
- [ ] Compliance skeleton expansion (retention/deletion/access reviews)
