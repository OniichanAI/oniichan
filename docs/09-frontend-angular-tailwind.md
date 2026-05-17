# 09 - Frontend Guide (Angular + Tailwind)

## Frontend Objective

Deliver an operations-grade, low-friction interface where admins can:

1. Chat with AI for actions and insights
2. Review/confirm risky actions
3. Configure roles/policies/autonomy
4. Observe moderation health and incidents
5. Audit every decision and execution

## Rendering Strategy Recommendation

For v1: Angular SPA is sufficient and fastest to ship.

For phase 2: add SSR/hybrid only if SEO/public pages become important.

## Proposed App Structure

```text
frontend/
  src/app/
    core/
      auth/
      http/
      guards/
      interceptors/
      stores/
    shared/
      ui/
      forms/
      charts/
      feedback/
    features/
      dashboard/
      chatops/
      moderation/
      channels/
      roles/
      policies/
      audit/
      settings/
```

## Key Modules

1. Dashboard:
   - moderation state summary
   - alerts and anomalies
2. ChatOps:
   - streaming responses
   - tool-call preview
   - confidence indicator
3. Action Review:
   - confirmation cards for risky actions
   - before/after previews
4. Policies and Roles:
   - editable capability matrix
5. Audit Explorer:
   - filter by actor, action, time, risk tier
6. Knowledge/RAG Manager:
   - upload and reindex controls for owner

## UX Design Rules (ADHD-Friendly)

1. Progressive disclosure:
   - show summary first, details on demand
2. Clear hierarchy:
   - one primary CTA per view
3. Fast visual feedback:
   - loading states and execution progress
4. Chunking:
   - small cards instead of long text walls
5. Color semantics:
   - stable color coding for risk/status
6. Motion:
   - purposeful transitions, not decorative noise

## Tailwind Implementation Recommendations

1. Define CSS variables for theme tokens.
2. Use component-level utility patterns with semantic wrappers.
3. Avoid dense screens:
   - 8pt spacing grid
   - large click targets
4. Keep contrast strong and typography clear.

## State Management

Recommended:

1. Signals for local UI state
2. RxJS for async streams/websocket updates
3. Feature stores for domain state
4. Optimistic updates only for low-risk actions

## Chat UI Execution Flow

1. User prompt input
2. Stream assistant response
3. Show:
   - detected intent
   - confidence score
   - planned actions
4. If confirmation required:
   - explicit action summary
   - confirm/cancel choices
5. Execution receipt displayed after completion

## Frontend Security

1. Store access token in memory when possible
2. Refresh token in secure HTTP-only cookie
3. Global route guards by role/capability
4. Redact sensitive data in client logs
5. Strict CSP in deployment

## Accessibility Baseline (Even If Not Priority)

1. Keyboard navigation for all critical actions
2. Screen-reader labels for key controls
3. Focus management in modals
4. Reduced motion option

## Suggested v1 Screen List

1. Login
2. Server select/onboarding
3. Dashboard
4. ChatOps Console
5. Moderation Control
6. Channel Manager
7. Role and Permission Mapping
8. Autonomy Settings
9. Audit and Reports
10. Tenant Settings
