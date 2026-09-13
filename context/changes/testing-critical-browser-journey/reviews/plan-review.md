<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Critical Browser Journey

- **Plan**: `context/changes/testing-critical-browser-journey/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-13
- **Verdict**: SOUND
- **Findings**: 1 critical, 2 warnings, 0 observations
- **Triage**: 3 fixed, 0 skipped, 0 accepted, 0 dismissed

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 6/6 path targets ✓ (3 existing, 3 planned additions), 8/8 symbols ✓, brief↔plan ✓

## Findings

### F1 — Missing OpenRouter prerequisite disables generation journeys

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phases 1–3 prerequisites
- **Detail**: The plan lists only Supabase credentials and Chromium as prerequisites. However, the Generate button is disabled unless `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are non-empty. The flag is calculated in `src/lib/config-status.ts:29`, passed by `src/pages/dashboard.astro:48`, and enforced in `src/components/flashcards/FlashcardWorkspace.tsx:181`. Browser routing cannot intercept a generation request that the disabled button never sends, so risks #1 and #3 cannot run from the environment currently promised by the plan.
- **Fix**: Require non-empty, safe test-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values in the fixture preflight and cookbook. State explicitly that no provider call occurs because the browser route intercepts generation.
- **Decision**: FIXED — required safe test-only OpenRouter values in fixture preflight, cookbook contract, and manual setup

### F2 — “Fresh” anonymous context inherits authenticated storage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 fixture contract; Phase 4 ownership scenario
- **Detail**: Current Playwright documentation and the installed 1.63 implementation confirm that configured `storageState` is injected into `browser.newContext()` unless that option is explicitly supplied. A plain “fresh context” will therefore inherit the fixture owner's session and invalidate the anonymous redirect/API assertions.
- **Fix**: Specify `browser.newContext()` with an explicit empty storage state for anonymous checks and explicit second-user storage state for the other account. Close auxiliary contexts before deleting their users.
- **Decision**: FIXED — specified empty anonymous state, explicit second-user state, and context closure before cleanup

### F3 — Final database reset can hide broken fixture cleanup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 and Phase 5 automated verification
- **Detail**: Both reset-based commands end with `npm run db:reset`. If fixture deletion silently fails, that reset removes the leaked identities and cards, so the command cannot demonstrate that teardown worked. This weakens the central promise that each test cleans up its own state.
- **Fix**: Require immediate registration of every created user ID, attempt hard deletion of every registered ID even after one failure, and fail teardown on any deletion error before the final reset.
- **Decision**: FIXED — made cleanup exhaustive and test-failing before the trailing safety reset
