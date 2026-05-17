# 14 - Deep-Dive Interview (Remaining Decisions)

These questions close the remaining gaps before implementation starts.

## Product and Scope

1. What is the first server profile to optimize for (gaming, creator, study, support)?
2. What is the expected average active members per tenant in first month?
3. What is the max acceptable accidental moderation action count per month?

## Moderation Policy and Autonomy

1. Which sanctions should autonomy mode be allowed to perform immediately in v1?
2. Should autonomy mode ever ban users directly, or only escalate to human confirmation?
3. What is the initial slow-mode sensitivity scale and thresholds?
4. How long should autonomous slow-mode stay active before re-evaluation?
5. Should repeated model uncertainty automatically disable autonomy mode?

## Behavior Scoring

1. Should moderator manual overrides influence future scoring weights?
2. Should score penalties decay over time, and over which period?
3. Which actions are considered severe violations vs minor infractions?

## Permissions

1. Should owners be able to create custom action bundles per app-role?
2. Are there immutable protected roles/channels in every tenant?
3. Should policy changes require confirmation or two-person approval?

## AI/LLM Operations

1. Do you want strict deterministic mode for critical action prompts?
2. Should all critical prompts be replayable with snapshot context?
3. How many candidate models should the router test in staging before promotion?
4. What is the maximum tolerated monthly inference downtime?

## Data and Privacy

1. Should raw chat prompts be retained, anonymized, or deleted quickly?
2. Should message content for moderation analytics be sampled, filtered, or full capture?
3. What default retention window should be used before explicit compliance requirements?

## UX and Workflow

1. Should chat show policy rationale by default or only on expand?
2. Should high-risk actions use a two-step confirm dialog or typed confirmation?
3. Should admins be able to export audit timelines as CSV/JSON in v1?

## Operations

1. Who receives alerts in first production release?
2. What is acceptable response time for production incidents?
3. Should emergency "read-only mode" be available for system incidents?

## Delivery Constraints

1. What is the minimum viable launch date target?
2. How many weekly hours can each team member allocate?
3. Which features must be cut first if schedule slips?
