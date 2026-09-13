# Review Continuity Integration Testing Implementation Plan

## Overview

Complete rollout Phase 3 by proving that review ratings persist exactly once, survive authoritative reloads, and make
cards due at the documented boundaries. Add deterministic coverage at the scheduler adapter, Astro handler, PostgreSQL,
local Supabase, and React component layers, while fixing the known identical-request concurrency race required for the
new integration gate to finish green.

## Current State Analysis

The review feature is implemented and has substantial pgTAP, local Supabase, scheduler-script, and manual evidence.
Existing database checks cover owner-only membership, ordering, active-session resumption, sequential replay, stale-write
rollback, atomic persistence, expiry, and cascades. The remaining gaps are the real scheduler-to-handler-to-RPC
composition, a second scheduling transition from persisted state, adjacent time-boundary cases, and executable client
reconciliation tests.

The previous implementation review also identified a production defect: `apply_flashcard_review` performs its replay
lookup before request-scoped serialization, so simultaneous identical requests may not both receive the canonical result.
Current rating verification is sequential, while its HTTP/UI checks inspect source strings instead of behavior.

## Desired End State

The repository has a required deterministic integration gate for risk #5. It proves literal FSRS adapter outputs,
authoritative rating orchestration, exact due/wait/expiry boundaries, durable reacquisition, identical-request concurrency,
and visible React retry/reconciliation behavior. Concurrent identical requests produce one application and one replay,
with one durable mutation and the same canonical fields. The test plan's cookbook explains how to extend this coverage and
states what remains for Phase 4 E2E.

### Key Discoveries:

- The endpoint calculates real scheduler state and passes it to the transactional RPC before rereading authoritative
  session state (`src/pages/api/review/rate.ts:78-160,249-270`).
- Existing SQL and local verifier tests pass handcrafted post-state, so they do not prove the production FSRS adapter
  composes with persistence (`supabase/tests/database/spaced_repetition.test.sql:168-226`,
  `scripts/verify-spaced-repetition.mjs:195-276`).
- The replay lookup precedes serialization, and the unique-collision handler cannot cover stale/member failures that occur
  earlier (`supabase/migrations/20260901000000_add_spaced_repetition.sql:235-278,345-364`).
- Vitest already supports Node and per-file jsdom suites, with direct-handler and queued-fetch patterns available under
  `tests/integration/flashcards/` (`vitest.config.ts:14-20`, `tests/setup-dom.ts:1-35`).
- Accepted policy makes server time authoritative: due selection is inclusive, the waiting threshold is 60 seconds, and
  active sessions expire at 24 hours (`context/changes/spaced-repetition-session/research.md:181-200`).

## What We're NOT Doing

- Adding Playwright, browser routing, authentication-cookie, middleware, hydration, or full user-journey coverage; those
  belong to rollout Phase 4.
- Starting Astro inside a new HTTP verifier or repeating the completed manual browser matrix.
- Reopening the accepted FSRS algorithm, version, configuration, rating scale, session size, or scheduling policy.
- Testing `ts-fsrs` internals, generating expected values with production scheduler helpers, or adding broad snapshots.
- Re-testing established RLS, ordering, sequential replay, stale rollback, cascades, or collection behavior without a new
  risk-specific assertion.
- Editing the already-applied `20260901000000_add_spaced_repetition.sql` migration or adding a destructive down migration.
- Adding CI, infrastructure, observability, or a reusable general-purpose Supabase fake.

## Implementation Approach

Correct the exactly-once database primitive first with a forward migration and a real concurrent local verifier. Extend
database boundary evidence with literal adjacent timestamps. Then add focused Vitest suites for the deterministic FSRS
adapter and direct rating handler, followed by React integration tests for confirmed-only progress and reconciliation.
Use literal independent fixtures throughout and keep each layer's claim boundary explicit. Finish by replacing weak
source-shape assertions, running the complete local gates, and documenting the shipped cookbook pattern.

## Critical Implementation Details

### Timing & concurrency

Acquire the transaction-scoped request lock before the existing replay lookup; moving only the unique-violation handler is
insufficient because a losing call may fail earlier on member or schedule-version validation. Preserve the current stable
intent identity and ignore newly derived time/post-state/result fields on replay. Treat bounded `Promise.all` trials as
practical runtime evidence, not deterministic proof of overlap. Pair them with a pgTAP assertion over
`pg_get_functiondef()` that the request-lock statement occurs before the replay-log lookup. The combined gate requires the
structural ordering plus one durable mutation/log and one applied plus one replayed result in every runtime trial; neither
check alone proves the contract.

### State sequencing

Use fixed server instants and literal adjacent timestamps for `due <= cutoff`, `nextDue <= reviewedAt + 60 seconds`, and
`expiresAt <= cutoff`. React tests must keep the original card/progress until a canonical response arrives and must retry
the byte-equivalent stored request body rather than create a new rating intent.

## Phase 1: Database Continuity and Concurrent Replay

### Overview

Make the exactly-once primitive satisfy its existing contract, then prove concurrency and all accepted time boundaries at
the real database layer.

### Changes Required:

#### 1. Forward migration for request-scoped serialization

**File**: `supabase/migrations/20260913000000_serialize_review_requests.sql`

**Intent**: Serialize identical review request identities before replay detection so simultaneous retries converge on one
canonical stored result without double-applying progress.

**Contract**: Replace `public.apply_flashcard_review` without changing its signature, JSON result shape, stable-intent
comparison, validation order after replay detection, `security definer`, empty `search_path`, or role grants. Acquire a
transaction-scoped advisory lock from an unambiguous domain-prefixed `(p_user_id, p_request_id)` key before selecting the
existing log. Preserve one applied outcome, canonical replay reconstruction, changed-intent conflict, and all atomic card,
member, session, and log writes.

#### 2. Concurrent rating verifier

**File**: `scripts/verify-spaced-repetition.mjs`

**Intent**: Exercise concurrently initiated identical RPC calls through the local PostgREST boundary and provide practical
runtime evidence for the production concurrency invariant with durable state inspection.

**Contract**: Run a bounded set of trials, each using a fresh due member, request UUID, and shared literal argument object
for two concurrently initiated `Promise.all` calls. In every trial, require exactly one `applied` and one `replayed`
outcome; compare canonical fields other than `outcome`; assert one log, one card schedule-version increment, one member
increment, and one session/rating-counter increment. Describe this as practical scheduling evidence rather than proof of
overlap. Retain the distinct sequential replay, changed-intent, stale-version, RLS, and cascade checks.

#### 3. Literal database time-boundary contracts

**File**: `supabase/tests/database/spaced_repetition.test.sql`

**Intent**: Protect inclusivity at each state threshold using independent fixtures rather than relying on broad examples.

**Contract**: Add an ordering assertion over `pg_get_functiondef('public.apply_flashcard_review(...)'::regprocedure)` that
the request-scoped advisory-lock statement precedes the existing-log lookup. Keep the match narrow enough to tolerate
whitespace while failing if either operation disappears or changes order. Also add isolated fixed-time cases proving a
future card is excluded immediately before its due instant and admitted at equality; a post-review due time exactly 60
seconds ahead remains waiting while one millisecond later defers; and an active session is reusable immediately before
expiry but replaced at the exact 24-hour cutoff. Update the pgTAP plan count and keep expectations literal.

### Success Criteria:

#### Automated Verification:

- Forward migration and boundary contracts pass: `npm run db:reset && npm run db:lint && npm run db:test`
- Concurrent rating verification demonstrates one durable application and canonical replay in every bounded trial:
  `npm run verify:spaced-repetition`
- The unchanged RPC schema still matches generated types: `npm run db:types:check`

---

## Phase 2: Scheduler and Rating-Handler Integration

### Overview

Lock the application-owned scheduler adapter to independent expected outputs and prove that the real rating handler sends
those results into persistence and returns authoritative state.

### Changes Required:

#### 1. Literal FSRS adapter contract

**File**: `tests/integration/review/fsrs.test.ts`

**Intent**: Detect drift in the pinned scheduler configuration and the database-row conversion boundary without testing
the vendor library in isolation.

**Contract**: Use a literal `ScheduledFlashcardRow` and fixed review instant. Assert complete literal `postState` and
`nextDue` outputs for ratings 1–4, canonical date/null mapping, and the exported scheduler policy. Feed a literal expected
first-transition row into at least one second transition. Fixture changes are intentional review points when the pinned
package or configuration changes; expected values must not be generated through `ts-fsrs` or production helpers.

#### 2. Direct rating-handler integration contract

**File**: `tests/integration/review/rate.test.ts`

**Intent**: Prove endpoint validation, scheduling orchestration, RPC arguments, error mapping, replay behavior, and
authoritative response shaping without introducing running-app or cookie setup.

**Contract**: Import the route handler directly, freeze one server instant, keep `scheduleReview` real for the core success
case, and mock only the narrow admin/session seams. Assert the exact stable intent, reviewed time, literal scheduler
post-state, audit result, and authoritative reread response. Cover pre-client validation, existing-request replay without
rescheduling, session/member/version/not-due conflicts, invalid RPC output, and ambiguous failure. Use controlled scheduler
outputs only for exact ready/waiting/deferred classification at now, +60 seconds, and +60 seconds plus one millisecond.
The suite must not claim RLS, database durability, concurrency, cookies, middleware, or deployed routing.

#### 3. Review environment test stub

**File**: `tests/support/astro-env.ts`

**Intent**: Allow direct review-handler imports under Vitest without widening test configuration or leaking real secrets.

**Contract**: Export the review failure-mode variable expected by the handler. Keep server credentials mocked behind the
admin-client seam; add no live environment dependency to the application test suite.

### Success Criteria:

#### Automated Verification:

- Focused scheduler and handler suites pass: `npm run test -- tests/integration/review/fsrs.test.ts tests/integration/review/rate.test.ts`
- Existing scheduler smoke evidence remains green: `npm run verify:fsrs`
- The complete Vitest suite and type-aware lint pass: `npm run test && npm run lint`

---

## Phase 3: React Continuity and Rollout Completion

### Overview

Replace source-shape assertions with executable client behavior, document the resulting claim boundaries, and run the
complete Phase 3 quality gate.

### Changes Required:

#### 1. Review-session React integration contract

**Files**: `tests/integration/review/SpacedRepetitionSession.test.tsx`,
`src/components/review/SpacedRepetitionSession.tsx`

**Intent**: Prove visible continuity and retry behavior through accessible user interactions while keeping server state
and browser crossings outside the component suite.

**Contract**: Use jsdom, shared DOM setup, explicit session/result fixtures, accessible locators, queued fetch responses,
deferred promises, fixed time, and a stable `crypto.randomUUID`. Cover: no card/progress advance before canonical success;
successful installation only from `result.session`; ambiguous/network failure retaining and retrying byte-equivalent JSON
with the same request UUID; `409` reconciliation from an embedded session or exactly one read-only reload; failed fallback
reload leaving the last rendered session non-rateable, reporting reconciliation failure, and retrying only the authoritative
session read rather than the rating mutation; and authoritative reload when the only waiting card reaches its due instant.
Make the minimal component state-flow change needed to prevent `send()` from restoring `view = "ready"` after `load(true)`
fails. Re-establish globals in each test because shared cleanup removes them. Do not claim real networking, routing,
hydration, cookies, authentication, database state, focus, or cross-page behavior.

#### 2. Remove superseded source-shape checks

**File**: `scripts/verify-spaced-repetition.mjs`

**Intent**: Keep the local database verifier focused on behavior it actually executes once the handler and React suites
replace string-presence assertions.

**Contract**: Remove checks that read endpoint/component source for failure-mode names and state-update fragments. Retain
all runtime Supabase verification, including the new concurrent rating case from Phase 1.

#### 3. Review-continuity cookbook pattern

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.5's placeholder with the canonical references, fixture policy, commands, and honest layer boundaries
shipped by this rollout phase.

**Contract**: Document the scheduler, handler, React, pgTAP, and local-verifier references; fixed-time and literal-oracle
rules; the request-concurrency invariant; required run commands; local Supabase prerequisites and cleanup; and what each
layer cannot prove. Preserve frozen strategy/risk content and keep browser/auth-cookie/full-journey claims assigned to
Phase 4.

### Success Criteria:

#### Automated Verification:

- React continuity suite passes: `npm run test -- tests/integration/review/SpacedRepetitionSession.test.tsx`
- All deterministic application and scheduler tests pass: `npm run test && npm run verify:fsrs`
- Complete local database gate and runtime verifier pass with reset cleanup: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run verify:spaced-repetition && npm run db:reset`
- Repository deployment check passes: `npm run deploy:check`

#### Manual Verification:

- Human confirms §6.5 names the shipped references and commands accurately without claiming Phase 4 browser coverage

**Implementation Note**: After all automated verification passes, pause for human confirmation of the cookbook claim
boundaries before marking the rollout phase complete.

---

## Testing Strategy

### Unit Tests:

- No new isolated unit-test layer. The smallest application tests remain integration contracts around the real FSRS
  adapter and direct Astro handler.
- Literal scheduler fixtures cover all ratings and a second transition; deliberate library/configuration upgrades require
  fixture review.

### Integration Tests:

- pgTAP owns deterministic database thresholds and transactional contracts.
- The local Supabase verifier owns genuine concurrent RPC calls and durable exact-once inspection.
- Direct-handler Vitest owns validation, scheduler-to-RPC composition, error mapping, and authoritative reread shaping.
- React Testing Library owns visible confirmed-only progress, identical retry intent, conflict reconciliation, and due-time
  reload triggers.
- Phase 4 will own real browser, authentication-cookie, middleware, hydration, routing, and cross-page journey claims.

### Manual Testing Steps:

1. Review §6.5 after all suites pass and confirm every listed reference and command exists.
2. Confirm its claim boundaries distinguish mocked handler/component evidence from real-database evidence and Phase 4 E2E.

## Performance Considerations

The new request-scoped advisory lock adds one short transaction lock per rating. Unrelated hash collisions may serialize
requests but must not change results or corrupt state. Test suites use bounded literal fixtures; no load testing, caching,
or new persistent test infrastructure is warranted.

## Migration Notes

Ship a forward `CREATE OR REPLACE FUNCTION` migration with the existing RPC signature and result contract. It is compatible
with the current application and requires no data rewrite or regenerated TypeScript type delta. Preserve security-definer,
search-path, and grants explicitly because copying the function body is the main migration risk. Prefer roll-forward if a
problem appears; reverting to the old function would deliberately restore the known race and is not an automated rollback.

## References

- Related research: `context/changes/testing-review-continuity/research.md`
- Rollout strategy: `context/foundation/test-plan.md:15-21,42-49,59-60,183-189`
- Accepted session policy: `context/changes/spaced-repetition-session/research.md:181-204`
- Original implementation plan: `context/changes/spaced-repetition-session/plan.md`
- Concurrency findings: `context/changes/spaced-repetition-session/reviews/impl-review.md:23-59`
- Existing database contract: `supabase/tests/database/spaced_repetition.test.sql`
- Existing runtime verifier: `scripts/verify-spaced-repetition.mjs`
- Application test conventions: `tests/integration/flashcards/mutations.test.ts`,
  `tests/integration/flashcards/FlashcardCollection.test.tsx`, `tests/setup-dom.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Continuity and Concurrent Replay

#### Automated

- [x] 1.1 Forward migration and boundary contracts pass — 6cd30df
- [x] 1.2 Concurrent rating verification proves one durable application and canonical replay — 6cd30df
- [x] 1.3 Unchanged RPC schema matches generated types — 6cd30df

### Phase 2: Scheduler and Rating-Handler Integration

#### Automated

- [x] 2.1 Focused scheduler and handler suites pass — e385653
- [x] 2.2 Existing scheduler smoke evidence remains green — e385653
- [x] 2.3 Complete Vitest suite and type-aware lint pass — e385653

### Phase 3: React Continuity and Rollout Completion

#### Automated

- [x] 3.1 React continuity suite passes
- [x] 3.2 All deterministic application and scheduler tests pass
- [x] 3.3 Complete local database gate and runtime verifier pass with reset cleanup
- [x] 3.4 Repository deployment check passes

#### Manual

- [x] 3.5 Human confirms cookbook references, commands, and Phase 4 claim boundary
