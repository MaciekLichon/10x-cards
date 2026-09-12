<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Testing Collection Persistence and Ownership

- **Plan**: `context/changes/testing-collection-persistence-and-ownership/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-12
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 0 observations (4 fixed)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

8/8 existing paths verified, 4/4 new paths explicitly declared, 9/9 symbols verified, brief↔plan consistent.

## Findings

### F1 — Progress omits four manual success criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress — Phases 1–4
- **Detail**: Each phase defines two manual verification bullets, but Progress collapses them into one checkbox. Four success criteria therefore have no matching Progress item, violating the mechanical contract consumed by `/10x-implement`.
- **Fix**: Give every manual criterion its own checkbox—add steps 1.4, 2.5, 3.5, and 4.5—and use titles matching the criteria.
- **Decision**: FIXED — added distinct Progress checkboxes 1.3–1.4, 2.4–2.5, 3.4–3.5, and 4.4–4.5 matching every manual success criterion.

### F2 — Shared database fake spans eight query shapes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Test environment and shared database fake
- **Detail**: The proposed “small” shared fake must support eight materially different chains, including thenable builders, repeated `eq` and `order`, optional `or`, queued follow-up queries, and scalar versus array results. No comparable abstraction currently exists. Without tighter boundaries, test infrastructure may become its own framework.
- **Fix A ⭐ Recommended**: Start with suite-local narrow builders and extract only repeated record/response behavior.
  - Strength: Each fake mirrors one handler and stays easy to audit.
  - Tradeoff: Some initial duplication between suites.
  - Confidence: HIGH — no existing shared Supabase fake constrains the design.
  - Blind spot: The eventual duplication amount is not yet known.
- **Fix B**: Specify a shared queued-query recorder contract in the plan.
  - Strength: Centralizes call capture and response sequencing.
  - Tradeoff: More abstraction and more behavior to validate.
  - Confidence: MEDIUM — feasible, but it must model all eight terminal shapes.
  - Blind spot: The helper API has not been designed.
- **Decision**: FIXED — revised Phase 2 to use suite-local narrow query builders, extracting only repeated record/response behavior and explicitly avoiding a general cross-suite query framework.

### F3 — Global shim cleanup can remove shims after the first test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — DOM/test support
- **Detail**: `tests/setup-dom.ts` calls `vi.unstubAllGlobals()` and `vi.restoreAllMocks()` after each test. Dialog or animation-frame shims installed once at module load could disappear after the first test.
- **Fix**: Require shim installation in `beforeEach`, with the existing `afterEach` restoration retained.
- **Decision**: FIXED — Phase 3 now requires browser shims to be installed in `beforeEach`, with per-test cleanup and mock restoration retained.

### F4 — Component-boundary fixture is assigned to the handler phase

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Batch save suite
- **Detail**: Phase 2 instructs the handler suite to include the mixed reviewed fixture “at the component boundary.” That boundary belongs to Phase 3, which already specifies the same accepted-valid/rejected/invalid scenario.
- **Fix**: Remove the component-fixture sentence from Phase 2 and leave it exclusively in the Phase 3 workspace contract.
- **Decision**: FIXED — removed the component-boundary fixture assignment from Phase 2 and kept review-state coverage scoped to Phase 3.

## Verification Notes

The core technical claims were confirmed: request validation precedes client creation, UI ambiguity recovery does not replay mutations, and database policies plus column privileges enforce ownership and content-only edits.

## Triage Summary

- **Fixed**: F1 (Progress criteria), F2 (suite-local query builders), F3 (per-test DOM shims), F4 (Phase 2/3 boundary)
- **Skipped**: none
- **Accepted**: none
- **Dismissed**: none

**Final verdict**: SOUND
