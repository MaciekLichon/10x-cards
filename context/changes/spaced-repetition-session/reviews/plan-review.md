<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Spaced Repetition Session Implementation Plan

- **Plan**: `context/changes/spaced-repetition-session/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-01
- **Verdict**: SOUND
- **Findings**: 3 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 11/11 existing paths ✓, 5/5 symbols ✓, brief↔plan ✓, Progress↔phases ✓

## Findings

### F1 — Owners can directly overwrite scheduler state

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1.3 — RLS and server-only transactional function
- **Detail**: The plan says authenticated clients cannot directly mutate scheduler state, but the existing UPDATE policy authorizes owners to update their entire flashcard row (`supabase/migrations/20260815000000_create_flashcards.sql:42`). Existing verification deliberately proves ordinary-client updates (`scripts/verify-flashcard-rls.mjs:153`). RLS limits rows, not columns. Generated Supabase update types will also expose the new scheduler fields.
- **Fix**: Revoke table-wide UPDATE from `authenticated`, grant column-level UPDATE only for `front` and `back`, preserve owner RLS, and add ordinary-client tests proving scheduler fields cannot be changed.
- **Decision**: FIXED — applied the proposed column-level UPDATE privilege boundary and ordinary-client regression coverage

### F2 — Concurrent GETs can create duplicate active sessions

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1.2 and Phase 2.3 — Session lifecycle
- **Detail**: Phase 2 promises atomic resume-or-create, but Phase 1 defines only the rating transaction. Separate select-and-insert operations in the endpoint race across tabs. A partial unique index cannot use the time-dependent predicate `expires_at > now()`, and an `active` status remains active after wall-clock expiry until explicitly transitioned.
- **Fix ⭐ Recommended**: Define an atomic `get_or_create_review_session` database function. Lock per owner, expire the previous active row inside the transaction, select due membership, and insert or return the single active session under an enforceable lifecycle constraint.
  - Strength: Makes concurrent creation and the 24-hour lifecycle one database contract.
  - Tradeoff: Adds a second narrowly scoped transactional function.
  - Confidence: HIGH — endpoint-only creation cannot enforce this invariant.
  - Blind spot: The precise locking primitive still needs selection.
- **Decision**: FIXED — added atomic server-only session acquisition with per-owner advisory locking, explicit expiry transition, an active-owner constraint, and concurrency verification

### F3 — HTTP retries do not have stable RPC identity

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1.3 and Phase 2.4 — Replay contract
- **Detail**: The client repeats its request UUID and payload, but each endpoint retry generates a new `reviewed_at` and recalculates post-state. Both are RPC inputs, while the RPC promises replay only for an identical request and treats changed payloads as conflicts. A legitimate lost-response retry can therefore conflict instead of returning the stored result.
- **Fix ⭐ Recommended**: Define idempotency identity only from stable intent: owner, session, card, rating, and expected schedule version. On an existing request UUID, compare those fields and return the stored canonical result before validating newly derived timestamps/post-state.
  - Strength: Matches the payload the client can actually replay.
  - Tradeoff: The RPC must distinguish stable intent from derived inputs.
  - Confidence: HIGH — the current inputs necessarily change across calls.
  - Blind spot: The stored result schema must be specified.
- **Decision**: FIXED — stable intent now defines idempotency; first-commit derived values and canonical result are stored and replayed with lost-response coverage

### F4 — Session membership representation is not implementable as stated

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1.2 — Session schema
- **Detail**: The plan requires ordered membership, uniqueness, owner-card consistency, deletion behavior, and deterministic progress, but does not choose a representation. PostgreSQL cannot attach a foreign key to every UUID inside an array, so an array alone cannot enforce the promised ownership contract.
- **Fix A ⭐ Recommended**: Add a normalized `flashcard_review_session_cards` table with ordinal and progress fields, unique session/card and session/ordinal constraints, and composite ownership foreign keys.
  - Strength: Declarative integrity, straightforward progress queries, and explicit cascade behavior.
  - Tradeoff: Adds one table and joins to session reads.
  - Confidence: HIGH — directly represents every promised invariant.
  - Blind spot: Exact per-member progress columns still need naming.
- **Fix B**: Retain an ordered array/JSON field and define immutable membership plus a locking validation trigger.
  - Strength: A session snapshot is compact to read.
  - Tradeoff: Cross-table integrity and progress become procedural and harder to test.
  - Confidence: MEDIUM — feasible, but more fragile.
  - Blind spot: Card deletion and concurrent validation need explicit rules.
- **Decision**: FIXED — Fix A applied with normalized membership, explicit member progress state, composite ownership, uniqueness, cascades, and deterministic resume rules

### F5 — Ratings invalidate unrelated content edits

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1.2 — Flashcard scheduling columns
- **Detail**: Every review update will fire `set_flashcards_updated_at` (`supabase/migrations/20260815000000_create_flashcards.sql:12`). Content PATCH and DELETE use `updated_at` as their concurrency token (`src/pages/api/flashcards/[id].ts:114` and `:153`). Reviewing a card therefore makes an unrelated open edit/delete stale, despite the new `schedule_version` already separating scheduler concurrency.
- **Fix**: Specify that the trigger advances `updated_at` only when content fields change, while scheduler writes advance `schedule_version`; add a regression test covering review followed by content edit.
- **Decision**: FIXED — content and scheduler concurrency tokens are separated, with scheduler-then-content-edit regression coverage

## Triage Summary

- **Fixed**: F1, F2, F3, F4 (Fix A), F5
- **Skipped**: None
- **Accepted**: None
- **Dismissed**: None
- **Verdict after fixes**: RETHINK → SOUND
