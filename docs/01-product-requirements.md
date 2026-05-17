# 01 - Product Requirements

## Scope Summary

The platform is a web-based AI operations console for Discord server management with:

1. Moderation state intelligence
2. Channel management automation
3. User and role administration
4. Natural-language action execution
5. Autonomous moderation mode (toggleable)

## Core v1 Feature Set

## 1) Moderation Intelligence

1. Moderation state overview (daily/weekly)
2. Moderator action trends and consistency
3. Highlight suspicious/controversial moderation decisions
4. Behavior score for users (0-100)
5. Explainable evidence snippets for score and flags

## 2) Channel Management

1. Create/rename/delete channels and categories
2. Bulk channel provisioning via natural language
3. Voice/text channel templates
4. Permission and visibility updates
5. Slow-mode operations and raid response controls

## 3) User and Role Management

1. Role assignment and removal
2. Admin-defined app roles mapped to Discord roles
3. Mute/deafen/timeout/kick/ban flows
4. Restriction profiles by tenant
5. Approval rules for high-risk actions

## 4) Natural Language ChatOps

1. Parse requests into intent + validated tool calls
2. Ask clarifying questions on low confidence
3. Show dry-run plan before execution when needed
4. Execution receipts with actor, rationale, and outcome

## 5) Autonomous Mode

1. Toggle on/off by owner/admin
2. Per-tenant policy boundaries
3. Rate and blast radius limits
4. Kill switch
5. Automation decision audit stream

## Functional Requirements

1. Multi-tenant SaaS architecture with strict tenant isolation
2. One bot identity per tenant
3. Discord OAuth-only authentication in v1
4. Automatic Discord role mapping with manual override
5. Full action auditability

## Recommended Default Risk Tiers

1. Low risk:
   - Summaries, analytics reads, non-destructive lookups
2. Medium risk:
   - Slow-mode changes, role assignment, channel permission edits
3. High risk:
   - Kick/ban/delete channel/delete category mass actions

## Mandatory Human Confirmation (Default)

1. Ban/kick/mass timeout actions
2. Delete channel/category
3. Permission overwrites affecting more than N roles/channels
4. Any action on protected channels/roles
5. Any request with confidence below threshold

## Never-Do Rules (Recommended)

1. Never ban/delete based on single weak signal.
2. Never execute high-risk actions with low confidence.
3. Never alter owner/admin core permissions automatically.
4. Never run unbounded bulk destructive operations.
5. Never operate outside tenant-defined policy constraints.

## Latency and Accuracy Targets (Recommended)

1. Chat response:
   - p50 <= 1.8s
   - p95 <= 4.5s
2. Tool-selection precision:
   - >= 97% in validation set
3. Tool argument schema validity:
   - >= 99.5%
4. Critical action false-positive rate:
   - < 0.5%

## Product KPIs

1. Successful action execution rate
2. Moderator time saved per week
3. Corrective rollback rate
4. False positive moderation events
5. Autonomy mode safety incidents
