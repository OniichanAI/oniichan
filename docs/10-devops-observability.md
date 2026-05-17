# 10 - DevOps, CI/CD, and Observability

## CI/CD Recommendation

Use GitHub Actions with trunk-based development and feature flags.

Why:

1. Small team velocity
2. Reduced long-lived branch drift
3. Fast integration feedback

## Environment Strategy

1. `dev`:
   - rapid iteration
   - less strict gating
2. `staging`:
   - production-like validation
   - release candidate checks
3. `prod`:
   - controlled deployment
   - rollback automation

## Pipeline Stages

1. Lint + format checks
2. Unit tests
3. Integration tests
4. Contract tests (if FastAPI + Spring Boot split)
5. Security scanning (SAST/dependency)
6. Build artifacts/containers
7. Deploy to environment
8. Smoke tests

## Release Strategy

1. Trunk-based with short branches
2. Feature flags for incomplete features
3. Canary release for risky changes
4. Automatic rollback on SLO breach

## Observability Stack (Budget-Conscious)

Local/staging:

1. OpenTelemetry instrumentation
2. Prometheus + Grafana
3. Loki for logs
4. Tempo/Jaeger for traces

Production future:

1. Managed alternatives as budget allows
2. Alerting integration with Slack/Discord

## Golden Signals

1. Latency (p50/p95/p99)
2. Traffic volume
3. Error rate
4. Saturation (CPU/memory/queue depth)

## Domain-Specific Operational Metrics

1. Tool-call success/failure rates
2. Confidence distribution
3. Confirmation-required frequency
4. Autonomous action count by risk tier
5. Discord rate limit events
6. Moderation false positive rate

## SLO Framework (Initial)

1. Chat availability: `99.5%`
2. Action execution success: `>= 99%` for non-destructive operations
3. Audit ingestion lag: `< 10s` at p95
