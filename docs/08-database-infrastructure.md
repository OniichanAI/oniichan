# 08 - Database and Infrastructure Recommendations

## Primary Database Recommendation

Use PostgreSQL as the primary database from day one.

Why:

1. Strong consistency and relational integrity
2. Mature indexing and query planning
3. Multi-tenant patterns are well established
4. Works with `pgvector` for embeddings/RAG
5. Zero-cost local development is straightforward

## Suggested Data Stack

1. PostgreSQL:
   - operational data
   - audits
   - configs
   - tenant metadata
2. `pgvector`:
   - embeddings for RAG
3. Redis:
   - caching
   - job queue backend
   - rate limits and short-lived state
4. Object storage (optional now, required later):
   - local MinIO in dev
   - S3-compatible in production

## Why Not Separate Vector DB in v1

With budget constraints and team size 2, start with `pgvector` to reduce operational burden. Re-evaluate dedicated vector DB only if retrieval scale/latency becomes a bottleneck.

## Multi-Tenant Data Model (Core Tables)

1. `tenants`
2. `users`
3. `user_tenant_roles`
4. `discord_guilds`
5. `discord_bot_credentials`
6. `policies`
7. `chat_sessions`
8. `chat_messages`
9. `tool_executions`
10. `moderation_events`
11. `behavior_scores`
12. `audit_events`
13. `knowledge_documents`
14. `knowledge_chunks`
15. `feature_flags`

## Schema Recommendations

1. Add `tenant_id` indexed in all tenant-owned tables.
2. Use UUID primary keys.
3. Add soft-delete for key entities.
4. Add immutable append-only audit table.
5. Use migration tooling:
   - Alembic for Python services
   - Flyway/Liquibase if Spring Boot later

## Local Development Stack (Zero Budget)

Use Docker Compose:

1. `postgres:16`
2. `redis:7`
3. `minio/minio`
4. `backend-fastapi`
5. `frontend-angular`
6. optional `worker`

## Production Migration Targets

Cloud options:

1. AWS:
   - RDS PostgreSQL
   - ElastiCache Redis
   - S3
   - ECS/Fargate
2. Hetzner:
   - managed PostgreSQL alternative
   - self-managed Redis
   - object storage compatible service

## Backup and Recovery Plan

1. Daily automated DB backups
2. Point-in-time recovery enabled when available
3. Weekly restore drill
4. Audit table integrity checks
