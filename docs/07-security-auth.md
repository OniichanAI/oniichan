# 07 - Authentication, Authorization, and Security

## Authentication (v1)

Discord OAuth only:

1. User clicks "Login with Discord"
2. Discord redirects to callback
3. Backend exchanges code for tokens
4. Backend creates internal user identity linked to Discord ID
5. Session established in app

## Session Strategy (Recommended)

Use short-lived access token + rotating refresh token:

1. Access token:
   - 15 minutes
   - signed JWT
2. Refresh token:
   - 7-30 days
   - stored hashed in DB
   - rotation on each refresh
3. Revoke on logout and suspicious activity

For MVP simplicity, secure server-side session cookies are also acceptable if deployment is single region.

## Authorization Model (Recommended)

Use hybrid RBAC + policy checks:

1. RBAC for baseline role permissions
2. Policy layer for contextual constraints:
   - channel sensitivity
   - time windows
   - protected roles/users
   - autonomous mode limits

Reason: RBAC alone is too static for high-stakes moderation actions.

## Role Mapping

1. Auto map Discord roles to app roles on onboarding
2. Owner can override mapping manually
3. Provide safe defaults:
   - Owner
   - Admin
   - Moderator
   - Analyst
   - Viewer

## High-Risk Action Safeguards

1. Mandatory confirmation workflow
2. Optional two-person approval for very critical actions
3. Cooldown windows for repeated sanctions
4. Protected entities list (cannot be targeted by automation)

## Audit and Forensics

Each action log entry includes:

1. Actor identity
2. Tenant/server
3. Prompt and parsed intent
4. Confidence score
5. Policy decision trace
6. Final Discord API response
7. Timestamp and correlation ID

## Security Baseline (v1)

1. Secrets in `.env` only for local dev, never committed
2. Input validation on every endpoint
3. Output encoding and frontend XSS controls
4. CSRF protection for cookie session mode
5. Rate limiting per actor and per tenant
6. Structured security logs

## Future-Ready Compliance Skeleton

Even without immediate compliance needs:

1. Data classification registry
2. Retention policy framework
3. Deletion workflow framework
4. Incident response runbook template
5. Access review procedure placeholder
