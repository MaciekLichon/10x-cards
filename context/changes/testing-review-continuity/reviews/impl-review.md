<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Review Continuity Integration Testing Implementation Plan

- **Plan**: context/changes/testing-review-continuity/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-09-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Background refresh can discard a pending rating intent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/review/SpacedRepetitionSession.tsx:83
- **Detail**: The `online` and `visibilitychange` handler reloads every active session without checking `view` or `pending`. If it runs while a rating POST is in flight or after an ambiguous failure, a successful `load(true)` clears `pending` at line 34 and restores `view = "ready"` at line 36. That can discard the stable request UUID and temporarily permit a new rating intent against stale state before the original POST is canonically reconciled. The new component suite verifies direct ambiguous retry, but does not dispatch either background event during submission or ambiguous recovery.
- **Fix**: Suppress active-session background reloads unless `view === "ready"` and no rating intent is pending, and add component cases for `online`/`visibilitychange` during submission and ambiguous recovery.
  - Strength: Preserves the byte-equivalent retry contract while retaining background refresh for idle active sessions and due-card reloads.
  - Tradeoff: A tab cannot opportunistically refresh from another tab while a local rating intent still needs resolution; the explicit retry/reconciliation path remains authoritative.
  - Confidence: HIGH — the state transitions and missing event cases are directly visible in the component and its integration suite.
  - Blind spot: Browser-level event timing and hydration remain Phase 4 scope.
- **Decision**: FIXED — background refresh now requires an idle ready state with no pending rating intent; regression coverage exercises both `online` and `visibilitychange` during submission and ambiguous recovery.

## Verification Evidence

- `npm run db:reset && npm run db:lint && npm run db:test` — PASS (102 pgTAP assertions; no schema errors)
- `npm run verify:spaced-repetition` — PASS (all three concurrent replay trials and durable-state checks passed)
- `npm run db:types:check` — PASS
- `npm run test -- tests/integration/review/fsrs.test.ts tests/integration/review/rate.test.ts` — PASS (34 tests)
- `npm run verify:fsrs` — PASS (`ts-fsrs` 5.4.2, `fsrs-v6-defaults-v1`)
- `npm run test && npm run lint` — PASS (142 tests; zero lint errors, four unrelated existing warnings)
- `npm run test -- tests/integration/review/SpacedRepetitionSession.test.tsx` — PASS (7 tests)
- `npm run test && npm run verify:fsrs` — PASS
- `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run verify:spaced-repetition && npm run db:reset` — PASS; final reset removed transient fixtures
- `npm run deploy:check` — PASS after allowing its local inspection-port bind; build and Wrangler dry-run completed
- Manual criterion 3.5 is marked complete in Progress. The reviewed cookbook diff names the shipped references and commands and keeps browser/auth-cookie/full-journey claims in Phase 4.

## Triage Verification

- F1 fix: `npm run test -- tests/integration/review/SpacedRepetitionSession.test.tsx` — PASS (11 tests)
- F1 fix: `npm run lint` — PASS (zero errors; four unrelated existing warnings)
