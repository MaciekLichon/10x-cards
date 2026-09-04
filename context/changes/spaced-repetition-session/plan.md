# Spaced Repetition Session Implementation Plan

## Overview

Implement S-05 as a protected, resumable review workflow powered by pinned `ts-fsrs@5.4.2`. The server selects only
cards due at a server-owned cutoff, calculates FSRS v6 transitions, and persists each rating atomically and
idempotently. A database-backed session preserves membership and progress for 24 hours, while an accessible React
island guides the user through answer reveal, rating, short-term re-entry, recovery, and completion.

## Current State Analysis

The application already has authenticated Astro SSR, cookie-aware Supabase clients, owner-scoped flashcards, React
islands, mutation conflict handling, and local database verification. Flashcards currently persist content and
ownership only. There is no scheduler dependency, FSRS state, review history, review-session model, due-card API, or
review UI. Existing mutation endpoints use RLS and distinguish definite failures from ambiguous writes, but rating a
card needs a stronger server-only boundary because the client must not be able to manufacture its own schedule.

## Desired End State

An authenticated user can open `/dashboard/review`, resume an unexpired session or start one containing at most 20 of
their cards due at the session cutoff, reveal each answer, and submit Again, Hard, Good, or Easy. Confirmed ratings
survive refreshes and concurrent retries exactly once. Cards due again within one minute return after other ready
cards; longer waits are deferred. Empty and completed sessions present clear outcomes, and no user can inspect,
schedule, or review another user's card.

### Key Discoveries:

- `flashcards` has no scheduling columns, due index, or review relation (`supabase/migrations/20260815000000_create_flashcards.sql:1-53`).
- `/dashboard/**` is already protected, and the page-to-React-island pattern is established (`src/middleware.ts:4-23`, `src/pages/dashboard.astro:10-42`).
- Existing writes reject stale versions and reconcile ambiguous outcomes instead of blindly retrying (`src/pages/api/flashcards/[id].ts:56-72,114-131`).
- Database schema/RLS proof uses pgTAP plus an ordinary authenticated client, without service-role evidence (`supabase/tests/database/flashcards.test.sql:1-223`, `scripts/verify-flashcard-rls.mjs:98-220`).
- Current Context7 documentation confirms `generatorParameters`, `createEmptyCard`, `repeat`, and `next`; database timestamps must still be serialized as ISO strings at this application's boundary (`context/changes/spaced-repetition-session/ts-fsrs-docs.md:15-76`).

## What We're NOT Doing

- Building or optimizing a custom spaced-repetition algorithm or copying the default FSRS weight vector.
- Exposing `Rating.Manual`, accepting ratings outside 1–4, or trusting client-calculated scheduler state.
- Allowing arbitrary card selection, user-configurable scheduler parameters, custom session sizes, or sessions longer
  than 20 initial cards.
- Resetting progress when front/back content is edited, detecting conceptual edits, or retaining review logs after a
  flashcard is deleted.
- Adding Vitest, browser automation, analytics dashboards, notification/reminder features, or a detailed per-card
  completion report.
- Updating stale roadmap Unknowns, backlog notes, or open-question prose beyond the required status fields.

## Implementation Approach

Start with a stop/go compatibility spike for the exact scheduler version. Extend PostgreSQL with FSRS state, an
append-only review log, and owner-scoped review sessions that expire 24 hours after creation. Session membership is a
durable ordered set captured from `due <= cutoff`; completed membership is derived from persisted session progress,
not client state. The authenticated API performs selection and FSRS calculations. A narrowly scoped server-only
Supabase client calls a transactional RPC that locks the owned card, enforces the session and expected schedule
version, updates the card, appends the log, advances session progress, and returns replay-safe state. The React island
advances only after confirmation and resubmits the same request UUID when an outcome is ambiguous.

## Critical Implementation Details

### Timing & lifecycle

Each session uses one database cutoff and `expires_at = created_at + interval '24 hours'`. A rating uses one
server-generated `reviewed_at` for the FSRS calculation and transaction. The UI may wait only when an admitted session
card is due within 60 seconds; it must clear timers on unmount and re-fetch authoritative state after visibility or
network recovery rather than trusting an expired local countdown.

### State sequencing

Do not remove the current card, increment summary counts, or expose the next card until the rating response is
confirmed as applied or replayed. A stale transition triggers session reconciliation and a brief notice; an ambiguous
transition retries the identical request UUID and payload. The transaction must record the review and session progress
in the same commit as the card update.

### Security boundary

The transactional RPC must not be executable by `anon` or `authenticated`. Only a server-only client configured with
`SUPABASE_SERVICE_ROLE_KEY` may call it, and the API must pass the already-authenticated user's ID explicitly after
validating the cookie session. The RPC must still predicate every locked/read row on that owner ID; the privileged key
must never be imported into client code or returned in responses.

## Phase 1: Scheduler Compatibility and Data Foundation

### Overview

Prove the pinned scheduler works in the Cloudflare-targeted server bundle, then establish the complete persistent
contract for FSRS cards, durable sessions, atomic reviews, access control, and generated types.

### Changes Required:

#### 1. Exact scheduler dependency and smoke contract

**Files**: `package.json`, `package-lock.json`, `scripts/verify-fsrs-scheduler.mjs`

**Intent**: Pin `ts-fsrs` exactly at `5.4.2` and make bundle/runtime compatibility the first stop/go gate. The script
also guards the accepted rating/config mapping and ISO serialization boundary.

**Contract**: `npm run verify:fsrs` constructs `fsrs(generatorParameters(...))` with policy
`fsrs-v6-defaults-v1`, creates an empty card, applies ratings 1–4 through `next`, rejects Manual/invalid ratings at the
application boundary, and proves returned dates can be stored as canonical ISO strings. The policy sets retention
0.9, maximum interval 36500, fuzz off, short-term on, learning steps `1m/10m`, relearning step `10m`, and package
default weights.

#### 2. Scheduling, history, and session schema

**File**: `supabase/migrations/20260901000000_add_spaced_repetition.sql`

**Intent**: Add durable scheduler state to every card, append-only audit history, and resumable 24-hour review
sessions without changing current flashcard creation payloads.

**Contract**: Extend `flashcards` with `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`,
`learning_steps`, `reps`, `lapses`, `state`, nullable `last_review`, monotonic `schedule_version`, scheduler version,
and config version. Backfill `due` from `created_at`; database defaults must represent an empty FSRS card for all future
AI/manual inserts. Enforce FSRS-compatible domains and add `(user_id, due, id)`. Replace the current unconditional
`updated_at` trigger contract so it advances only when `front` or `back` changes. Scheduler-only writes advance
`schedule_version` without changing the content concurrency token, preserving an already-open content edit or delete.

Create `flashcard_review_sessions` with owner, cutoff, lifecycle timestamps, 24-hour expiry, lifecycle status, and
summary counters. Protect the `active` status with a partial unique index on owner. Wall-clock expiry alone does not
change status; the session acquisition transaction must first mark any expired active row `expired`, then resume the
remaining active row or create exactly one replacement.

Represent ordered membership in `flashcard_review_session_cards`, with `session_id`, `user_id`, `flashcard_id`,
zero-based `ordinal`, state (`pending`, `ready`, `waiting`, `deferred`, or `completed`), nullable `next_due`,
`review_count`, and nullable `completed_at`. Add unique `(session_id, flashcard_id)` and `(session_id, ordinal)`
constraints, composite foreign keys `(session_id, user_id)` and `(flashcard_id, user_id)` to enforce common ownership,
and `ON DELETE CASCADE` for deletion of either parent. Membership is immutable after acquisition except for its
transactionally managed progress fields. The acquisition function inserts at most 20 members ordered by `due, id`;
the rating function updates member state and counters in the same transaction as the card and log. Derive resume
ordering and session summaries from these persisted member rows so ready-card precedence, waits, deferral, deletion,
and completion remain deterministic.

Create `flashcard_review_logs` with request UUID, owner/card/session identity, rating, reviewed time, pre/post FSRS
snapshots, scheduler/config versions, the canonical persisted rating-result fields needed to reconstruct the HTTP
response, and creation time. Enforce unique `(user_id, request_id)`, composite ownership, and `ON DELETE CASCADE` from
flashcard to logs. Logs are immutable through policy; parent deletion may cascade them. Idempotency identity consists
only of stable intent: owner, session, card, rating, and expected schedule version. Reviewed time, calculated post-state,
and the canonical result are outputs of the first successful application, not replay-identity fields.

#### 3. RLS and server-only transactional functions

**File**: `supabase/migrations/20260901000000_add_spaced_repetition.sql`

**Intent**: Preserve owner isolation for readable session/history data while making the state transition atomic and
unavailable for direct client-authored scheduling.

**Contract**: Enable owner-scoped RLS for sessions and logs. Authenticated users may read their own session/history
rows as required for reconciliation, but cannot update/delete logs or directly mutate scheduler state. Revoke
table-wide `UPDATE` on `flashcards` from `authenticated`, grant column-level `UPDATE` only for `front` and `back`, and
retain the existing owner-scoped UPDATE policy for those content writes. Define a schema-qualified transactional
function, such as `get_or_create_review_session`, that takes the authenticated owner ID and server-owned cutoff,
acquires a transaction-scoped PostgreSQL advisory lock derived from that owner UUID, marks their expired active row
`expired`, and then returns the active session or inserts one from at most 20 owned due cards ordered by `due, id`.
The partial unique active-owner index remains the final invariant guard.

Define a second schema-qualified transactional function, such as `apply_flashcard_review`, with explicit owner,
session, request, card, rating, expected schedule version, reviewed time, and server-calculated post-state inputs.
Revoke execution on both functions from `public`, `anon`, and `authenticated`; grant only to the server-only database
role.

On entry, `apply_flashcard_review` checks `(owner, request UUID)` before validating newly derived reviewed time or
post-state. If the request exists, it compares only owner, session, card, rating, and expected schedule version: an
identical stable intent returns the canonical persisted result reconstructed from the immutable log and current
session result fields, while reuse with different stable intent returns request conflict. For a new request, the
function locks the owner/session/card rows, rejects expired/non-member/not-yet-due cards, validates and persists the
server-derived reviewed time and post-state, rejects stale schedule versions without mutation, updates the card once,
inserts the pre/post log and canonical result once, advances session progress/summary once, and returns that canonical
persisted result. A concurrent unique-key collision must re-read the winning request and resolve by the same stable
intent comparison without double-applying a transition.

#### 4. Database catalog tests and generated contract

**Files**: `supabase/tests/database/flashcards.test.sql`, `supabase/tests/database/spaced_repetition.test.sql`,
`src/types/database.types.ts`

**Intent**: Lock schema, constraints, policies, function privileges, atomicity, and TypeScript bindings before API
work begins.

**Contract**: Update exact-column assertions for `flashcards`; cover empty-card defaults/backfill, due index shape,
normalized membership columns and uniqueness, session membership/expiry, composite ownership, immutable membership,
member progress transitions, append-only logs, parent cascade deletion, RPC privilege revocation, atomic rollback,
identical replay, changed-payload conflict, stale version rejection, not-due rejection, and competing requests from one
expected version. Prove two concurrent session-acquisition transactions for one owner return the same active session,
expiry is transitioned before replacement, and the unique active-owner constraint prevents a second active row. Prove
a repeated request UUID with identical stable intent returns the first canonical timestamp, post-state, and result even
when newly supplied derived inputs differ, while a stable-intent mismatch conflicts. Add ordinary-authenticated-client
assertions that owners can still update `front` and `back` but cannot directly update any scheduler column, including
through generated Supabase update types. Add a regression assertion that a scheduler-only update leaves `updated_at`
unchanged and advances `schedule_version`, while a content update still advances `updated_at`. Regenerate types only
from the applied local schema.

### Success Criteria:

#### Automated Verification:

- Exact scheduler smoke contract passes: `npm run verify:fsrs`
- Cloudflare-targeted scheduler bundle succeeds: `npx astro sync && npm run build`
- Local schema, lint, and pgTAP contracts pass: `npm run db:reset && npm run db:lint && npm run db:test`
- Generated database types match the local schema: `npm run db:types && npm run db:types:check`

#### Manual Verification:

- Migration and tests contain no service-role-based proof of user isolation
- Scheduler/config versions and the 24-hour session policy match the accepted planning decisions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Authoritative Scheduling APIs

### Overview

Implement typed server contracts for creating/resuming sessions and rating cards, with all selection and FSRS work on
the server and deterministic recovery for stale or ambiguous results.

### Changes Required:

#### 1. Server-only environment and database client

**Files**: `.env.example`, `astro.config.mjs`, `src/lib/supabase-admin.ts`, `src/lib/config-status.ts`

**Intent**: Introduce the privileged capability needed to call the protected transaction without widening the
ordinary cookie-aware client's permissions.

**Contract**: Declare `SUPABASE_SERVICE_ROLE_KEY` as a server secret, document local/Cloudflare configuration, and
construct a non-persistent server-only Supabase client. Review availability must fail closed when the secret is absent;
the ordinary `SUPABASE_KEY` continues to serve authentication and owner-scoped reads.

#### 2. Review domain and scheduler adapter

**Files**: `src/lib/spaced-repetition.ts`, `src/lib/fsrs.ts`

**Intent**: Centralize public DTOs, exact-key parsers, constants, state conversions, and the single exported scheduler
policy so API and UI cannot drift.

**Contract**: Define session/card/summary/rating response DTOs; accept only canonical UUIDs/timestamps and integer
ratings 1–4; expose session limit 20, wait threshold 60 seconds, expiry 24 hours, package version
`ts-fsrs@5.4.2`, and config version `fsrs-v6-defaults-v1`. Convert database state to/from the package `Card` contract
and ISO strings. The adapter owns `next`; no client module imports `ts-fsrs`.

#### 3. Session creation and resumption endpoint

**File**: `src/pages/api/review/session.ts`

**Intent**: Return one server-authoritative session snapshot that can be safely recreated after refresh or another-tab
activity.

**Contract**: An authenticated GET calls the server-only `get_or_create_review_session` function with the validated
user ID and one server-owned cutoff. The function serializes acquisition per owner, transitions an expired active
session, resumes the remaining active session, or atomically creates one from at most 20 owned rows with
`due <= cutoff`, ordered by `due, id`. Concurrent GETs for the same owner must return the same active session; expired
sessions are not resumed. The response includes only admitted card content/state needed by the UI, ready/waiting
disposition, progress summary, cutoff, and expiry, derived from normalized member rows in persisted
state/`next_due`/ordinal order. Empty selection returns a successful empty state, not an error.

#### 4. Rating endpoint and reconciliation mapping

**File**: `src/pages/api/review/rate.ts`

**Intent**: Apply one user rating with authoritative timing/calculation and stable HTTP semantics for retries and
multi-tab conflicts.

**Contract**: POST requires same origin, authentication, JSON content type, exact payload keys, a stable request UUID,
session/card IDs, rating 1–4, and expected schedule version. The endpoint verifies the session snapshot, freezes one
server `reviewed_at`, computes `scheduler.next`, and calls the protected RPC. On retry, the endpoint may derive a new
timestamp/post-state, but the RPC identifies an identical request only by owner, session, card, rating, and expected
schedule version and returns the first stored canonical result before validating those new derived values.
`applied`/identical `replayed` return 200 with the same canonical result; stale/request conflict return 409 with a fresh
session snapshot; unavailable or non-member rows return a non-disclosing 404/409; invalid inputs return 400/415/422;
infrastructure uncertainty returns a stable ambiguous code that instructs retry with the same request UUID. Responses
never expose internal user IDs, privileged credentials, or trusted post-state inputs.

### Success Criteria:

#### Automated Verification:

- Astro types and generated routes synchronize: `npx astro sync`
- Type-aware lint passes: `npm run lint`
- Cloudflare production build passes with server-only scheduler/admin imports: `npm run build`
- Database contract remains green after API integration: `npm run db:test && npm run db:types:check`

#### Manual Verification:

- API inspection confirms rating payloads cannot supply `reviewed_at`, post-FSRS state, owner ID, or session membership
- Missing server-only configuration fails closed without exposing secret values

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Accessible Review Experience

### Overview

Add navigation and a protected React review island that reveals answers before rating, resumes durable state, manages
short waits, reconciles conflicts, and provides a compact completion outcome.

### Changes Required:

#### 1. Review route and dashboard navigation

**Files**: `src/pages/dashboard/review.astro`, `src/pages/dashboard.astro`, `src/pages/dashboard/collection.astro`

**Intent**: Make review discoverable from existing protected pages while retaining the established Astro shell and
React-island boundary.

**Contract**: Add `/dashboard/review` with one `client:load` review island. Add Review links to both existing dashboard
headers and mark the active link with `aria-current="page"`. No middleware change is required because the protected
`/dashboard` prefix already covers the route.

#### 2. Session state machine and API recovery

**Files**: `src/components/review/SpacedRepetitionSession.tsx`, `src/components/review/ReviewCard.tsx`

**Intent**: Model loading, question, revealed answer, submitting, waiting, reconciling, empty, complete, and failed
states explicitly so irreversible progress is never represented optimistically.

**Contract**: Load/resume the server snapshot on mount. Generate one request UUID per rating intent and retain the
exact payload until applied/replayed or definitively rejected. Disable reveal/rating controls during submission. On
ambiguous failure retry the same event; on 409 replace local state with the authoritative snapshot, announce that
progress changed elsewhere, and continue. Network retry never creates a second rating event.

#### 3. Reveal, ratings, waiting queue, and focus

**Files**: `src/components/review/ReviewCard.tsx`, `src/components/review/ReviewControls.tsx`

**Intent**: Deliver the accepted study interaction with clear keyboard and screen-reader behavior.

**Contract**: Initially render the front and a real Reveal answer button. Render/enable Again, Hard, Good, and Easy
only after reveal; Manual is absent. After reveal move focus to the rating group; after a confirmed rating move focus
to the next card heading. Process all ready cards before waiting cards. If only admitted cards due within 60 seconds
remain, show an accessible countdown and enable the next card at its server due time; cards due later are deferred and
the session completes. Clear timers on unmount and revalidate when the tab becomes active.

#### 4. Empty, completion, and error outcomes

**File**: `src/components/review/SpacedRepetitionSession.tsx`

**Intent**: Give clear closure without expanding into a detailed analytics report.

**Contract**: Empty state explains that no cards are due and links back to the workspace/collection. Completion shows
cards reviewed, counts for the four ratings, whether short-term cards were deferred, and actions to return or request
another due session. Use `role="status"` for loading/waiting, assertive alerts for actionable errors, and concise polite
announcements for confirmed progress. Preserve card whitespace and visible focus rings.

### Success Criteria:

#### Automated Verification:

- Astro synchronization succeeds: `npx astro sync`
- Type-aware lint passes for the review state machine and accessibility rules: `npm run lint`
- Cloudflare production build succeeds: `npm run build`

#### Manual Verification:

- Empty, active, waiting, deferred, and completed sessions match the approved behavior
- Keyboard-only flow reveals, rates, advances, and restores focus without hidden or prematurely enabled controls
- Refresh within 24 hours resumes the same session; refresh after expiry starts from a new cutoff
- A stale rating from another tab reconciles with an explanation and preserves confirmed progress

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Resilience and End-to-End Evidence

### Overview

Exercise the complete security, atomicity, scheduling, retry, expiry, and UI contracts and leave reproducible evidence
for the MVP guardrails.

### Changes Required:

#### 1. Ordinary-client authorization and transaction verifier

**Files**: `scripts/verify-flashcard-rls.mjs`, `scripts/verify-spaced-repetition.mjs`, `package.json`

**Intent**: Prove isolation and replay behavior through the same anonymous/authenticated surfaces available outside
the application, without treating privileged setup as authorization evidence.

**Contract**: Extend or add a local-only executable verifier and script alias that creates two ordinary users and
proves owner-only due/session/history reads, cross-account denial, direct scheduler-column UPDATE denial while owned
`front`/`back` updates remain allowed, direct RPC denial, forged membership rejection, identical request replay,
changed-payload request conflict, stale-version rejection, concurrent acquisition returning one active session,
expiry-before-replacement, atomic card/log/session updates, and cascade deletion. Privileged access may seed fixtures
only and must not be used for isolation assertions. Also prove that reviewing a card does not invalidate the
`updated_at` token captured by an already-open content edit, and that the subsequent content update advances that token.

#### 2. Scheduler/API failure-mode coverage

**Files**: `scripts/verify-fsrs-scheduler.mjs`, `astro.config.mjs`, `.env.example`,
`src/pages/api/review/session.ts`, `src/pages/api/review/rate.ts`

**Intent**: Make lost-response and conflict recovery reproducible and protect the server-side policy contract without
adding a general test framework.

**Contract**: Add development-only failure modes for session load failure, rating failure before commit, lost response
after commit, and forced stale transition. Verification proves same-request reconciliation, one log per accepted
intent, replay of the first canonical timestamp/post-state/result despite newly derived retry inputs, conflict when a
request UUID is reused for different stable intent, no advance before confirmation, deterministic 1–4 mapping, version
audit fields, and ISO timestamps.

#### 3. Manual acceptance evidence

**File**: `context/changes/spaced-repetition-session/reviews/manual-verification.md`

**Intent**: Record non-sensitive evidence for behavior that command-line contracts cannot establish, especially focus,
visual states, timers, refresh, and multi-tab recovery.

**Contract**: Document environment and results for due ordering, 20-card cap, answer gating, all four ratings, ready
queue precedence, a wait of at most 60 seconds, longer deferral, empty/completion summary, refresh before/after 24-hour
expiry, lost response, two-tab conflict, deletion cascade, keyboard flow, responsive desktop layout, and cross-account
attempts. Do not record credentials, tokens, service-role keys, or user content.

### Success Criteria:

#### Automated Verification:

- Complete local database gate passes: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check`
- Ordinary-client RLS and review verifier passes: `npm run db:verify-rls && npm run verify:spaced-repetition`
- Scheduler contract passes: `npm run verify:fsrs`
- Final application gates pass: `npx astro sync && npm run lint && npm run build`

#### Manual Verification:

- Manual verification matrix is complete with no unresolved failed scenario
- No rating is lost or applied twice during refresh, lost-response, and two-tab scenarios
- No tested path reveals or mutates another user's card, session, or review history
- Desktop keyboard, focus, countdown, error, empty, and completion experiences are acceptable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual
confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No general JavaScript unit framework is introduced.
- Use the focused scheduler executable to assert policy constants, rating validation, date conversion, and deterministic
  server-side state mapping.
- Use pgTAP for database domains, defaults, indexes, policies, privileges, transactional outcomes, and concurrency
  invariants.

### Integration Tests:

- Use ordinary authenticated Supabase clients to prove owner isolation and denial of direct transactional RPC access.
- Exercise session create/resume, exact replay, request conflict, stale version, expiry, not-due rejection, cascade
  deletion, and atomic card/log/session progress.
- Exercise development failure modes to distinguish safe retries from ambiguous outcomes.

### Manual Testing Steps:

1. Create cards, confirm due ordering and the 20-card initial membership boundary, then complete all four rating paths.
2. Verify answer gating, keyboard focus, busy states, and that UI progress changes only after confirmation.
3. Review other ready cards before a card due within 60 seconds, observe the countdown, and confirm longer waits defer.
4. Refresh and reopen an active session within 24 hours; then verify an expired fixture produces a new session cutoff.
5. Simulate a lost response and a two-tab stale write; confirm exactly-once progress and explanatory reconciliation.
6. Verify empty and completion states, rating totals, deferred-card notice, navigation, and responsive desktop layout.
7. With two users, attempt forged card/session/RPC access and confirm no cross-account data is disclosed or changed.

## Performance Considerations

Session selection is bounded to 20 rows and supported by `(user_id, due, id)`. Resume and rating queries must use
owner/session/card keys rather than scanning review history. Store compact session membership/progress rather than
duplicating card content. Client timers run only while a wait of at most 60 seconds is relevant. The MVP has no known
load target; validate query plans locally but do not add caching or premature archival infrastructure.

## Migration Notes

The migration is additive. Existing cards receive empty FSRS state and `due = created_at`; current AI/manual insert
payloads remain valid through database defaults. Deploy schema and protected function before application code that
reads scheduling columns, configure `SUPABASE_SERVICE_ROLE_KEY` before enabling review routes, and deploy the pinned
application bundle afterward. Rollback of application code is safe while additive schema remains; dropping scheduling
tables/columns is destructive and must not be part of an automated rollback. Review logs are intentionally removed
when their parent card is deleted.

## References

- Related research: `context/changes/spaced-repetition-session/research.md`
- Current scheduler reference: `context/changes/spaced-repetition-session/ts-fsrs-docs.md`
- Product guardrails: `context/foundation/prd.md:40-43,92-106`
- Roadmap slice: `context/foundation/roadmap.md:129-141`
- Existing schema/RLS pattern: `supabase/migrations/20260815000000_create_flashcards.sql:1-53`
- Existing conflict handling: `src/pages/api/flashcards/[id].ts:56-72,114-131`
- Existing React reconciliation/accessibility pattern: `src/components/flashcards/FlashcardCollection.tsx:69-93,143-195,340-385`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scheduler Compatibility and Data Foundation

#### Automated

- [x] 1.1 Exact scheduler smoke contract passes: `npm run verify:fsrs`
- [x] 1.2 Cloudflare-targeted scheduler bundle succeeds: `npx astro sync && npm run build`
- [x] 1.3 Local schema, lint, and pgTAP contracts pass: `npm run db:reset && npm run db:lint && npm run db:test`
- [x] 1.4 Generated database types match the local schema: `npm run db:types && npm run db:types:check`

#### Manual

- [x] 1.5 Migration and tests contain no service-role-based proof of user isolation
- [x] 1.6 Scheduler/config versions and the 24-hour session policy match the accepted planning decisions

### Phase 2: Authoritative Scheduling APIs

#### Automated

- [ ] 2.1 Astro types and generated routes synchronize: `npx astro sync`
- [ ] 2.2 Type-aware lint passes: `npm run lint`
- [ ] 2.3 Cloudflare production build passes with server-only scheduler/admin imports: `npm run build`
- [ ] 2.4 Database contract remains green after API integration: `npm run db:test && npm run db:types:check`

#### Manual

- [ ] 2.5 API inspection confirms rating payloads cannot supply `reviewed_at`, post-FSRS state, owner ID, or session membership
- [ ] 2.6 Missing server-only configuration fails closed without exposing secret values

### Phase 3: Accessible Review Experience

#### Automated

- [ ] 3.1 Astro synchronization succeeds: `npx astro sync`
- [ ] 3.2 Type-aware lint passes for the review state machine and accessibility rules: `npm run lint`
- [ ] 3.3 Cloudflare production build succeeds: `npm run build`

#### Manual

- [ ] 3.4 Empty, active, waiting, deferred, and completed sessions match the approved behavior
- [ ] 3.5 Keyboard-only flow reveals, rates, advances, and restores focus without hidden or prematurely enabled controls
- [ ] 3.6 Refresh within 24 hours resumes the same session; refresh after expiry starts from a new cutoff
- [ ] 3.7 A stale rating from another tab reconciles with an explanation and preserves confirmed progress

### Phase 4: Resilience and End-to-End Evidence

#### Automated

- [ ] 4.1 Complete local database gate passes: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check`
- [ ] 4.2 Ordinary-client RLS and review verifier passes: `npm run db:verify-rls && npm run verify:spaced-repetition`
- [ ] 4.3 Scheduler contract passes: `npm run verify:fsrs`
- [ ] 4.4 Final application gates pass: `npx astro sync && npm run lint && npm run build`

#### Manual

- [ ] 4.5 Manual verification matrix is complete with no unresolved failed scenario
- [ ] 4.6 No rating is lost or applied twice during refresh, lost-response, and two-tab scenarios
- [ ] 4.7 No tested path reveals or mutates another user's card, session, or review history
- [ ] 4.8 Desktop keyboard, focus, countdown, error, empty, and completion experiences are acceptable
