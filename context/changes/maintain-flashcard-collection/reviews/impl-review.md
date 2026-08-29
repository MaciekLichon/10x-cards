<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Maintain Flashcard Collection Implementation Plan

- **Plan**: context/changes/maintain-flashcard-collection/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Real transport failures bypass mutation reconciliation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/flashcards/FlashcardCollection.tsx:177
- **Detail**: `sendMutation` only reaches reconciliation when the server returns a readable JSON error with code `mutation_ambiguous`. A rejected `fetch()` or unreadable/truncated JSON response throws `TypeError` or `SyntaxError`; the update/delete handlers map that to a definitive failure and skip the required authoritative rebuild. This violates the plan's lost-response contract and can invite a user retry after the mutation actually landed.
- **Fix**: Convert transport and response-decoding failures inside `sendMutation` to `mutation_ambiguous`, while preserving readable definitive API errors.
  - Strength: Routes every genuinely indeterminate response through the existing read-only reconciliation path without repeating the mutation.
  - Tradeoff: Requires careful separation of network/decoding failures from valid non-2xx JSON responses.
  - Confidence: HIGH — the existing update/delete handlers already implement the intended reconciliation once they receive this code.
  - Blind spot: Browser-level failure injection was not rerun against the proposed correction.
- **Decision**: FIXED — transport and response-decoding failures now raise `mutation_ambiguous` and use the existing reconciliation path.

### F2 — Timestamp parser accepts impossible calendar dates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/flashcards.ts:76
- **Detail**: The mutation contract requires a canonical ISO `updatedAt`, but the parser checks only shape and a finite JavaScript date. JavaScript normalizes values such as `2026-02-30T00:00:00Z`, so malformed calendar timestamps can pass validation instead of returning `422 invalid_flashcard`.
- **Fix**: Add a canonical round-trip/calendar-validity check, matching the stricter timestamp validation pattern already used by the collection cursor parser.
- **Decision**: FIXED — added a calendar/time round-trip check while preserving accepted fractional-second precision.

### F3 — Manual verification record has contradictory status

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/maintain-flashcard-collection/reviews/manual-verification.md:5
- **Detail**: The record header says `Pending manual verification`, while all 18 scenarios and the completion section say Pass. The plan marks all manual criteria complete, so the evidence artifact is internally inconsistent.
- **Fix**: Change the header result to `Pass — 18 passed, 0 failed` so it agrees with the recorded matrix and completion section.
- **Decision**: FIXED — changed the result header to `Pass — 18 passed, 0 failed` to match the scenario matrix.

### F4 — Collection timestamp canonicalization was not listed in the plan

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/flashcards/collection.ts:32
- **Detail**: The feature diff modifies the existing collection endpoint to canonicalize database timestamps, although that file is absent from the phase Changes Required lists. The change is benign and supports the new strict mutation contract, but it is an undocumented integration addition.
- **Fix**: Add a brief plan addendum documenting collection DTO timestamp canonicalization as required integration work.
- **Decision**: FIXED — added a Phase 1 plan entry documenting collection DTO timestamp canonicalization.
