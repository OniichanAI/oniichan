# 06 - AI Orchestration, Tool Calling, and RAG

## AI Architecture

Use a multi-stage pipeline instead of raw single-prompt execution:

1. Intent classifier
2. Risk and confidence estimator
3. Tool planner
4. Tool argument validator
5. Policy gate
6. Executor
7. Post-action summarizer

## Model Router Strategy

Use a router for efficiency:

1. Lightweight model:
   - intent classification
   - extraction
   - confidence estimate
2. Mid model:
   - multi-step planning
   - natural language response synthesis
3. Specialized moderation classifier:
   - toxic/abuse/raid signal scoring

## Tool Calling Contract

Each tool requires:

1. JSON schema
2. Argument type validation
3. Policy pre-check
4. Dry-run capability for risky actions
5. Idempotency key

## Confidence Policy

Recommended thresholds:

1. `>= 0.90`: execute if low/medium risk and policy allows
2. `0.75 - 0.89`: ask for confirmation or clarifying details
3. `< 0.75`: do not execute, ask user to rephrase with explanation

Low-confidence response template:

1. Explain uncertainty source
2. Show what information is missing
3. Offer exact rephrase examples

## Constrained Prompting Design

1. Strict role and objective
2. Allowed tool list only
3. Forbidden operation list
4. Output schema contract
5. Self-check step before final tool call
6. Confidence score with rationale tags

## RAG Design

Knowledge corpora per tenant:

1. Server rules
2. Moderation SOP
3. Incident playbooks
4. FAQ and conventions

RAG constraints:

1. Tenant-isolated embedding indexes
2. Metadata filters by channel/type/date
3. Citation required for behavior/rule explanations
4. Source freshness tracking

## Behavior Score (0-100)

Proposed composite score:

1. Positive signals:
   - sustained non-toxic participation
   - constructive interactions
2. Negative signals:
   - recent violations weighted by severity/recency
   - raid-associated behavior patterns
3. Moderator override signals:
   - confirmed false positive corrections

Use score bands:

1. `80-100`: healthy
2. `60-79`: caution
3. `40-59`: at risk
4. `<40`: critical

## Autonomous Moderation Mode

Mandatory controls:

1. Action whitelist by risk tier
2. Max actions per minute/hour/day
3. Protected target exemptions
4. Mandatory evidence recording
5. Immediate kill switch

## Evaluation Strategy

1. Build synthetic + real anonymized test set
2. Measure:
   - intent accuracy
   - tool call precision/recall
   - false positives for sanctions
3. Run regression suite before deployment

## Clarification On "Offline Evaluation Dataset"

It means a curated dataset of historical moderation prompts, expected tool actions, and expected arguments used to test model behavior before production changes.
