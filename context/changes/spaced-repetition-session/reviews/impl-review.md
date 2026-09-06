<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Spaced Repetition Session Implementation Plan

- **Plan**: context/changes/spaced-repetition-session/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-09-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Concurrent retries do not resolve to the canonical result

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260901000000_add_spaced_repetition.sql:235
- **Detail**: `apply_flashcard_review` checks for an existing request before taking a request-scoped lock. Two simultaneous identical calls can both observe no log; the loser can then return `stale_schedule_version`, or the unique-constraint handler at line 362 raises `concurrent_review_request`. The plan requires the collision call itself to re-read the winner, compare stable intent, and return the first canonical replay result (or a request conflict). A later retry can recover, but the contracted exactly-once response semantics are not met on the concurrent call.
- **Fix ⭐ Recommended**: Serialize `(p_user_id, p_request_id)` with a transaction-scoped advisory lock before the existing-log lookup, then retain the current stable-intent comparison.
  - Strength: Makes same-request concurrency deterministic before any card/session mutation and directly implements the plan's replay contract.
  - Tradeoff: Adds one transaction lock per rating request and requires a safe, stable lock-key derivation.
  - Confidence: HIGH — the migration already uses a transaction advisory lock for per-owner session acquisition.
  - Blind spot: Lock-key collision behavior should be documented and covered by a concurrent integration test.
- **Fix B**: In the unique-violation path, re-read the winning log and run the same stable-intent comparison.
  - Strength: Narrowly changes the existing collision handler.
  - Tradeoff: Same-card competitors may fail earlier at the schedule-version check, so this alone does not cover every race without additional ordering changes.
  - Confidence: MEDIUM — it fixes unique-key collisions but not the pre-insert stale-version race by itself.
  - Blind spot: PostgreSQL snapshot/exception-subtransaction visibility must be verified under the actual isolation level.
- **Decision**: SKIPPED

### F2 — Automated resilience evidence does not exercise concurrent rating or HTTP failure modes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: scripts/verify-spaced-repetition.mjs:195
- **Detail**: The verifier applies and replays ratings sequentially; it never submits concurrent identical requests or distinct requests against one expected schedule version. Its failure-mode checks at lines 333–344 only search endpoint/UI source text for mode names and state-update fragments rather than invoking the session/rating HTTP paths. This leaves the plan's concurrent collision, lost-response reconciliation, and no-advance-before-confirmation contracts without reproducible automated proof. The ordinary-client script also denies only the session RPC directly, while the `apply_flashcard_review` denial is covered by pgTAP rather than this verifier.
- **Fix ⭐ Recommended**: Extend the integration verifier with real concurrent rating calls and invoke the development API failure modes through a running local application; assert one mutation/log, canonical replay, stale conflict, and unchanged UI/session progress before confirmation.
  - Strength: Tests the observable contracts at the boundaries where the plan promises them and catches F1.
  - Tradeoff: Requires deterministic app startup/auth setup and makes the verifier slower and more operationally involved.
  - Confidence: HIGH — the existing verifier already provisions users and fixtures, so the missing work is focused on concurrency and HTTP orchestration.
  - Blind spot: UI focus behavior still requires manual or browser-level evidence, which the plan intentionally leaves manual.
- **Fix B**: Add database-level concurrent rating tests now and amend the plan to keep failure-mode checks manual/source-based.
  - Strength: Covers the highest-risk atomicity/idempotency gap with less test infrastructure.
  - Tradeoff: Reduces the original Phase 4 promise and still does not automatically prove endpoint/UI recovery behavior.
  - Confidence: MEDIUM — sufficient for the database race, incomplete for the stated end-to-end contract.
  - Blind spot: Source-shape assertions can keep passing while runtime behavior regresses.
- **Decision**: SKIPPED
