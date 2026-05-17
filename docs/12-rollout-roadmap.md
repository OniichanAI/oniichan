# 12 - Rollout Roadmap

## Phase 0 - Foundation (Week 1-2)

1. Repo setup and environment scaffolding
2. Discord app/bot and OAuth plumbing
3. Multi-tenant schema and auth baseline
4. Basic frontend shell and route structure

## Phase 1 - Core ChatOps (Week 3-5)

1. Prompt-to-tool pipeline in FastAPI
2. Safe tool execution with receipts
3. Channel/user/role action APIs
4. Basic chat UI with streaming and confirmations

## Phase 2 - Moderation Intelligence (Week 6-8)

1. Event ingestion pipeline
2. Moderation summary generation
3. Behavior score model v1
4. Audit explorer and dashboards

## Phase 3 - Autonomous Mode (Week 9-10)

1. Policy-gated automation engine
2. Sensitivity configuration for raid/slow-mode
3. Kill switch and safety monitoring
4. Incident replay and postmortem workflows

## Phase 4 - Hardening and Launch (Week 11-12)

1. Full test pass and reliability tuning
2. Security review and secret hygiene
3. Load tests and operational runbooks
4. Staging to production launch checklist

## Parallel Work Split For 2-Person Team

1. Engineer A:
   - FastAPI, AI orchestration, Discord integration
2. Engineer B:
   - Angular UI, auth UX, dashboards, action review
3. Shared:
   - data model
   - policy design
   - QA and release gates
