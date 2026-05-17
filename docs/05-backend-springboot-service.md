# 05 - Optional Spring Boot Service

## Why This Service Exists

Use Spring Boot only when policy complexity and enterprise integration justify the split.

Recommended responsibilities:

1. Policy rule authoring and evaluation
2. Rule versioning and simulation
3. Governance workflows for critical actions
4. External connectors in future enterprise phase

## When To Introduce

Introduce after v1 core stabilization, typically week 8+ when:

1. Policy code in FastAPI becomes difficult to maintain
2. Multiple policy authors need safe lifecycle controls
3. Rule explainability requirements increase

## Service Contract

FastAPI sends decision requests:

1. Actor context
2. Tenant policy snapshot
3. Candidate action + parameters
4. Risk score + confidence

Spring Boot returns:

1. `ALLOW` / `DENY` / `CONFIRM_REQUIRED`
2. Rule ID and explanation
3. Optional mitigation recommendations

## Minimal API

1. `POST /policy/evaluate`
2. `POST /policy/simulate`
3. `GET /policy/version/{id}`
4. `POST /policy/publish`

## Data Ownership

1. FastAPI remains source of truth for operational actions and audit.
2. Spring Boot stores policy artifacts and decision traces.
3. Cross-service event bus syncs policy change events.

## Technical Guidance

1. Use OpenAPI contracts between services.
2. Add contract tests in CI.
3. Keep auth via service-to-service JWT/mTLS later.
4. Do not duplicate tenant/user ownership models across services without clear boundaries.
