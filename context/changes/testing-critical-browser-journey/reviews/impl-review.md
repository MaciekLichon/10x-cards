<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Critical Browser Journey Implementation Plan

- **Plan**: context/changes/testing-critical-browser-journey/plan.md
- **Scope**: Phases 1–5 of 5
- **Date**: 2026-09-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Unrelated rollout status was bundled into the cookbook handoff

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md:59
- **Detail**: Phase 5 explicitly limited the handoff to the Phase 4 cookbook/status and required unrelated rollout phases to remain unchanged. Commit `e6ed29f` also changed Phase 3 Review continuity from `planned` to `complete`. The Phase 3 implementation exists, so the value may be accurate, but this change did not document why unrelated state reconciliation belonged in the browser-journey scope.
- **Fix A ⭐ Recommended**: Add a short plan addendum documenting the discovered stale Phase 3 status and why it was reconciled during Phase 5.
  - Strength: Preserves the accurate foundation state while making the deviation explicit for future reviews.
  - Tradeoff: Retroactively expands the recorded documentation scope by one narrowly bounded correction.
  - Confidence: HIGH — the Phase 3 change folder and implementation commits exist, so `complete` is supported.
  - Blind spot: The Phase 3 change remains `impl_reviewed`, not archived; this review did not decide whether rollout `complete` requires archival.
- **Fix B**: Revert only the Phase 3 row to its pre-change `planned` value and reconcile it through the Phase 3 change separately.
  - Strength: Restores strict adherence to this plan's scope boundary.
  - Tradeoff: Makes the foundation rollout table stale until the separate reconciliation lands.
  - Confidence: HIGH — `e6ed29f^` shows the exact pre-change row.
  - Blind spot: A downstream consumer may already rely on the current `complete` value.
- **Decision**: FIXED — applied Fix A by documenting the Phase 3 status reconciliation in the Phase 5 scope addendum.

### F2 — Hydration waits depend on Astro's private DOM structure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/e2e/invalid-generation-recovery.spec.ts:40; tests/e2e/seed.spec.ts:53
- **Detail**: Both specs query generated `astro-island` elements and their private `ssr` attribute through `page.waitForFunction()`. This is a DOM-structure selector, conflicts with the repository's hard E2E locator rule, couples the journeys to Astro implementation markup, and contradicts Progress item 3.5's claim that the seed is free of brittle-selector anti-patterns.
- **Fix**: Replace the private-markup wait with a retried accessible interaction whose character-count update proves that the controlled source input is hydrated and responsive.
- **Decision**: FIXED — replaced the Astro private-markup waits with retried accessible input interactions and observable character-count readiness.

## Triage Summary

- **Fixed**: F1 via Fix A; F2 via the proposed accessible readiness fix.
- **Pending**: None.
- **Post-triage verification**: Both affected Chromium specs passed together; ESLint completed with 0 errors and 4 pre-existing warnings; `git diff --check` passed.

## Verification Evidence

- `npm run test:e2e -- --list --project=chromium` — PASS; exactly 3 tests in 3 files.
- Reset-based risk #3 seed command — PASS; 1 Playwright test passed and both resets completed.
- Risk #1 spec — PASS; 1 Playwright test passed.
- Risk #3 focused integration suites — PASS; 29 tests passed.
- Risk #1 focused integration suites — PASS; 40 tests passed.
- Risk #4 spec — PASS on the clean isolated run; 1 Playwright test passed.
- Reset-based ordinary-client RLS verifier — PASS.
- Complete reset-based Chromium gate — PASS; 3 tests passed in parallel and the trailing reset completed.
- Full database gate — PASS; schema lint, 102 pgTAP tests, generated-type check, RLS verifier, and resets completed.
- Full application gate — PASS; Astro sync, 146 Vitest tests, ESLint with 0 errors, Astro check with 0 errors, and production build completed.
- Manual Progress items are checked. Diff/code evidence supports isolation, cleanup, claim boundaries, and untracked-secret requirements; item 3.5 is contradicted by F2.
