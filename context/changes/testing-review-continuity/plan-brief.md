# Review Continuity Integration Testing — Plan Brief

> Full plan: `context/changes/testing-review-continuity/plan.md`
> Research: `context/changes/testing-review-continuity/research.md`

## What & Why

Complete rollout Phase 3 by proving that confirmed review ratings persist exactly once, survive authoritative reloads,
and make cards due at the documented time boundaries. Close the known identical-request race so the new integration gate
can finish green rather than documenting a failing production contract.

## Starting Point

The review feature already has strong database, local Supabase, scheduler-script, and manual evidence. Missing coverage
connects the real FSRS adapter and rating handler to persistence, tests adjacent time thresholds, executes React
reconciliation behavior, and verifies concurrent rating retries rather than sequential ones.

## Desired End State

Risk #5 has a deterministic integration gate across scheduler, API, PostgreSQL, local Supabase, and React boundaries.
Simultaneous identical requests yield one application plus one canonical replay and one durable mutation. The cookbook
states exactly how to extend the pattern and what remains for Phase 4 E2E.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Concurrency defect | Test and fix in this change | A required Phase 3 gate must finish green | Research + Plan |
| HTTP depth | Direct handler + React + real DB | Strong signal without pulling browser/auth setup into Phase 3 | Research + Plan |
| FSRS oracle | Literal outputs for ratings 1–4 and a second transition | Pinned deterministic configuration makes drift actionable | Plan |
| Time boundaries | Due equality, 60 seconds, and 24 hours | Each threshold changes persisted behavior | Research + Plan |
| React behavior | Confirmation, retry, `409`, and due reload | Protects continuity without claiming E2E | Plan |

## Scope

**In scope:**

- Forward migration adding request-scoped transaction serialization.
- Real concurrent RPC verification and exact durable-state assertions.
- Literal database time-boundary tests.
- FSRS adapter and direct rating-handler Vitest suites.
- React integration tests for confirmed-only progress and reconciliation.
- §6.5 cookbook completion and full local quality gates.

**Out of scope:**

- Playwright, browser routing, cookies, middleware, hydration, and full journeys.
- Running-app HTTP verification and repeating the completed manual UI matrix.
- Scheduler-policy redesign, vendor-internal testing, CI, infrastructure, or broad snapshots.
- Editing the already-applied migration or adding a destructive down migration.

## Architecture / Approach

Correct the atomic database primitive first, verify it through concurrent local PostgREST calls, then connect the real
scheduler and handler with focused Node tests. Finish with jsdom React behavior, remove source-string checks, and publish
honest cookbook claim boundaries. Fixed times and literal expected values remain independent of production calculations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Database continuity | Serialized retries and exact database thresholds | Duplicate/lost progress under concurrency |
| 2. Scheduler and handler | Literal FSRS and real orchestration contracts | Valid-looking response without durable correctness |
| 3. React and rollout | Executable reconciliation behavior and cookbook gate | UI advances before confirmation or retries new intent |

**Prerequisites:** Resettable local Supabase, local test credentials, existing Vitest dependencies, and current review feature.
**Estimated effort:** Approximately three focused implementation sessions across three phases.

## Open Risks & Assumptions

- `Promise.all` provides practical concurrency but no deterministic barrier before the old lookup; durable positive
  postconditions are the stable gate after serialization.
- The forward migration must preserve the long function's security, grants, signature, and replay semantics exactly.
- Literal FSRS fixtures intentionally fail when the pinned package or configuration changes and then require review.

## Success Criteria (Summary)

- Concurrent identical requests return one applied and one replayed result with matching canonical fields and one mutation.
- Literal FSRS, API composition, time thresholds, reload durability, and React reconciliation tests all pass.
- Full application, database, verifier, and deployment gates pass; §6.5 claims no Phase 4 browser evidence.
