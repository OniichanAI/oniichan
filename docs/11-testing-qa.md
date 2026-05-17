# 11 - Testing and QA Strategy

## Test Pyramid

1. Unit tests:
   - policy logic
   - parsers
   - scoring functions
2. Integration tests:
   - API to DB
   - API to Redis
   - tool execution pipeline
3. End-to-end tests:
   - login
   - onboarding
   - chat to action flow
   - confirmation workflows

## AI-Specific QA

1. Prompt regression suite
2. Tool-call schema validation suite
3. Ambiguous prompt handling tests
4. Jailbreak/prompt-injection resistance tests
5. Adversarial moderation scenario tests

## Safety Test Matrix

1. Low confidence + high-risk intent must block execution.
2. Protected role target must deny.
3. Destructive bulk action must require confirmation.
4. Autonomous mode must respect policy boundaries.
5. Kill switch must stop autonomous actions immediately.

## Discord Integration Tests

1. Mock Discord API for deterministic CI tests
2. Sandbox Discord server for staging smoke tests
3. Rate-limit behavior and backoff verification
4. Idempotent retry validation

## Performance Testing

1. Simulate concurrent chat sessions
2. Measure latency under event bursts
3. Verify queue backlog tolerance
4. Run memory and connection soak tests

## Exit Criteria For v1 Launch

1. No open critical severity defects
2. Core user journeys pass end-to-end
3. Tool-call correctness above thresholds
4. Autonomous safety controls validated
5. Audit completeness confirmed
