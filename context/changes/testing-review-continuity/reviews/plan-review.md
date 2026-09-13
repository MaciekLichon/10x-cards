<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Review Continuity Integration Testing Implementation Plan

- **Plan**: context/changes/testing-review-continuity/plan.md
- **Mode**: Deep
- **Date**: 2026-09-13
- **Verdict**: SOUND
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 path intents ✓, 6/6 symbols ✓, brief↔plan ✓, Progress contract ✓

## Findings

### F1 — Concurrency test can pass without concurrent execution

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — synchronization design affects the primary gate
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details; Phase 1.2
- **Detail**: The plan promises a required deterministic gate proving the known pre-lookup race is fixed, but explicitly relies on `Promise.all` without a barrier. Its expected postcondition—one applied result, one replay, and one mutation—also occurs when the calls execute sequentially. The current defective function performs replay lookup at `supabase/migrations/20260901000000_add_spaced_repetition.sql:235` before later row locks at lines 253–278. A favorable scheduling run could therefore pass without exercising the race.
- **Fix A ⭐ Recommended**: Add deterministic lock coordination to the local verifier. Hold the exact request advisory lock through a direct local PostgreSQL connection, start both PostgREST RPCs, prove they remain blocked, then release the lock and assert applied plus replayed results.
  - Strength: Detects whether serialization occurs before replay lookup while retaining the real PostgREST and database boundary.
  - Tradeoff: Requires a narrow direct-database connection mechanism in the verifier and documented local connection prerequisites.
  - Confidence: MEDIUM — PostgreSQL lock ordering supports this design, but the repository's preferred direct connection method still needs selection.
  - Blind spot: Port and credential discovery across local environments.
- **Fix B**: Downgrade the test to repeated practical concurrency evidence and add a structural pgTAP assertion that serialization precedes lookup.
  - Strength: Avoids new verifier connection infrastructure.
  - Tradeoff: Part of the evidence becomes implementation-shaped rather than a deterministic behavioral proof.
  - Confidence: MEDIUM — it protects ordering but is more brittle.
  - Blind spot: Function-definition formatting can affect the assertion.
- **Decision**: FIXED via Fix B

### F2 — Failed 409 fallback can restore an unconfirmed ready state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — expected failure behavior must be decided
- **Dimension**: Blind Spots
- **Location**: Phase 3.1 — React integration contract
- **Detail**: The plan covers a `409` with an embedded session or a successful read-only reload, but not failure of that reload. In `src/components/review/SpacedRepetitionSession.tsx:108–113`, `send()` awaits `load(true)`, but `load()` catches its own error at lines 37–41. Control then returns to `send()`, which sets the success notice and `view = "ready"`. The stale card becomes rateable even though authoritative reconciliation failed.
- **Fix**: Add a `409`-without-session plus failed-reload case and specify that the component remains failed with rating controls disabled until an authoritative session is obtained.
  - Strength: Protects the continuity boundary under the exact error path that otherwise exposes stale state.
  - Tradeoff: Requires a small component behavior fix alongside the test.
  - Confidence: HIGH — the state overwrite is explicit in the current control flow.
  - Blind spot: Product copy for the reconciliation failure is unspecified.
- **Decision**: FIXED
