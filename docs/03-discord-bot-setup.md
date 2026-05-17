# 03 - Discord Application and Bot Setup

## 1) Create Discord Application

1. Open Discord Developer Portal.
2. Create new application.
3. Configure:
   - App name
   - Description
   - Branding assets
4. Create bot user under the application.
5. Save bot token in secure secret store (never in git).

## 2) OAuth2 Configuration

For user login in web app:

1. OAuth scopes:
   - `identify`
   - `guilds`
   - `guilds.members.read` (if needed for role mapping)
2. Redirect URI:
   - local dev callback
   - staging callback
   - production callback
3. Store `client_id`, `client_secret`, redirect URIs in environment config.

## 3) Bot Invite Scopes and Permissions

Recommended scopes:

1. `bot`
2. `applications.commands`

Permission strategy:

1. Start with minimum privileged permissions.
2. Add required permissions per feature gate.
3. Implement an app-level "permission verification" checker post-install.

## 4) Privileged Intents (Recommended)

Likely required:

1. `GUILD_MEMBERS` - membership and role context
2. `GUILD_MESSAGES` - moderation event analysis
3. `MESSAGE_CONTENT` - only if needed for deep text moderation signals
4. `GUILD_MODERATION` - moderation actions/events
5. `GUILD_PRESENCES` only if behavior modeling truly requires it

Use minimal intents for privacy and reliability.

## 5) Slash Commands + Web Chat

Use both:

1. Slash commands:
   - quick server actions
   - emergency moderation toggles
2. Web chat:
   - complex multi-step operations
   - analytics/summaries
   - policy configuration

## 6) One Bot Per Tenant

Because you requested one bot per tenant:

1. Each tenant installs their bot instance/app credentials
2. Store per-tenant bot token encrypted at rest
3. Token rotation support in settings
4. Health check per bot connection status

## 7) Rate Limits and Reliability

1. Centralize Discord client with request queue.
2. Per-route token bucket controls.
3. Global backoff on `429`.
4. Coalesce duplicate admin requests.
5. Use idempotency keys for destructive operations.

## 8) Setup Verification Checklist

1. OAuth login works end-to-end
2. Bot appears online in tenant server
3. Required intents enabled and validated
4. Slash command registration complete
5. Read/write action smoke tests pass
6. Audit entries generated for every action
