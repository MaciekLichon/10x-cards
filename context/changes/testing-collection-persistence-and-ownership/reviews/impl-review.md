<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Testing Collection Persistence and Ownership Implementation Plan

- **Plan**: context/changes/testing-collection-persistence-and-ownership/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-09-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | FAIL    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

## Findings

### F1 — Collection UI tests do not fully prove target identity

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: tests/integration/flashcards/FlashcardCollection.test.tsx:139
- **Detail**: The plan requires successful target-only edit/delete coverage. The suite proves the rendered PATCH result, but its fetch assertions at lines 168 and 186 check only method order, not the mutation URL, target ID, optimistic-lock version, or PATCH draft. A wrong-target request can therefore pass when the queued response contains the expected target. There is also no confirmed-success DELETE case proving that only TARGET disappears while DECOY remains; the cookbook nevertheless claims generic target-only success.
- **Fix**: Add exact mutation URL/body assertions to PATCH and DELETE scenarios, plus a confirmed-success DELETE test that removes TARGET and preserves DECOY.
  - Strength: Directly closes the component-to-route target-identity gap and makes the cookbook claim true for both mutations.
  - Tradeoff: Adds several assertions and one focused React scenario.
  - Confidence: HIGH — the missing evidence is visible in the current fetch stubs and scenario list.
  - Blind spot: This still will not prove database durability, which correctly remains assigned to the local verifier.
- **Decision**: FIXED — added exact PATCH/DELETE URL and payload assertions plus a confirmed-success DELETE target-isolation scenario; focused component suite passes (7 tests).

### F2 — Pagination response contract lacks a look-ahead boundary case

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/integration/flashcards/collection.test.ts:135
- **Detail**: The collection suite asserts a 21-row query limit and incoming-cursor filtering, but never supplies 21 rows to prove 20-row truncation and generation of the outgoing `nextCursor`. That leaves the planned pagination mapping contract only partially covered.
- **Fix**: Add a literal 21-row result fixture and assert 20 returned DTOs plus the cursor encoded from the look-ahead boundary.
- **Decision**: FIXED — added a 21-row boundary fixture proving 20-row truncation, look-ahead exclusion, and outgoing cursor derivation from row 20; focused route and component suites pass (22 tests), and targeted lint passes.

### F3 — Phase 4 changed a frozen strategy section

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md:57
- **Detail**: Phase 4 explicitly limited edits to §§6.3–6.4 and required §§1–5 and §7 to remain unchanged. Commit `32879bd` also changed §3 rollout rows. The Phase 2 row now says `change opened` even though this implementation is complete, while Progress item 4.4 claims there were no frozen-strategy changes.
- **Fix A ⭐ Recommended**: Document the state-sync exception in the implementation plan and update the Phase 2 rollout row to `complete`.
  - Strength: Keeps canonical rollout state accurate while making the deliberate deviation explicit.
  - Tradeoff: Treats the plan as an amended source of truth after implementation.
  - Confidence: HIGH — the commit diff and current completed progress are unambiguous.
  - Blind spot: The stateful `/10x-test-plan` orchestrator may impose an additional handoff convention not recorded in this implementation plan.
- **Fix B**: Revert both §3 row edits and leave rollout-state advancement to `/10x-test-plan`.
  - Strength: Restores strict compliance with the frozen-section guardrail.
  - Tradeoff: The foundation plan remains stale until the orchestrator advances it.
  - Confidence: MEDIUM — strict scope is restored, but canonical state stays temporarily inaccurate.
  - Blind spot: It is unclear whether the prior Phase 1 status edit was independently required.
- **Decision**: FIXED via Fix A — documented the §3 status-only exception in the implementation plan and synchronized the Phase 2 rollout row to `complete`.

### F4 — Database fakes do not assert the selected table

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/flashcards/collection.test.ts:90
- **Detail**: Collection and mutation fakes ignore the argument passed to `.from()` and never assert `from("flashcards")`. A wrong-table regression can satisfy these fluent mocks, unlike the neighboring save suite, which asserts the table name and payload.
- **Fix**: Capture and assert `from("flashcards")` in collection and mutation happy/classification paths.
- **Decision**: FIXED — captured `.from()` arguments and asserted `from("flashcards")` across collection and mutation happy/classification paths; targeted lint and route suites pass (41 tests).

### F5 — Completed manual smoke checks have no persisted evidence

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-collection-persistence-and-ownership/plan.md:337
- **Detail**: Progress items 3.4, 3.5, and 4.5 are checked, but neither the diff nor the commit messages record observable results for the local UI smoke scenarios. Automated component evidence exists, but it is not evidence that the stated manual run occurred.
- **Fix**: Add a concise dated verification note describing the exercised save/edit/delete/reconciliation scenarios and observed outcomes, or return those checkboxes to pending until rerun.
- **Decision**: FIXED — added a dated, non-sensitive manual verification record for save/edit/delete/reconciliation outcomes and linked it from Progress items 3.4, 3.5, and 4.5.

## Verification

- `npm run db:reset && npm run db:test && npm run db:verify-rls` — PASS (95 pgTAP assertions; named RLS/persistence scenarios passed).
- `npm run test -- tests/integration/flashcards/save.test.ts tests/integration/flashcards/collection.test.ts tests/integration/flashcards/mutations.test.ts` — PASS (53 tests).
- `npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx tests/integration/flashcards/FlashcardCollection.test.tsx` — PASS (22 tests).
- `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls` — PASS.
- `npx astro sync && npm run test && npm run lint && npx astro check && npm run build` — PASS (99 tests; lint 0 errors/4 pre-existing warnings; Astro check 0 errors; build completed with one generated-CSS warning).
