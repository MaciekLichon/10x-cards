<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Personal Flashcard Collection

- **Plan**: `context/changes/personal-flashcard-collection/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-23
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | PASS    |

## Grounding

Grounding: 7/7 existing paths ✓, 6/6 symbols ✓, 5 new targets correctly identified, brief↔plan ✓

## Findings

### F1 — API error contract is underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1.3 — Authenticated collection endpoint
- **Detail**: The endpoint promises “stable safe errors,” while Phase 2 requires client-side error mappings, but the plan does not define HTTP statuses and error codes for invalid cursors, invalid cards, query failures, conflicts, ambiguous saves, or reconciliation misses. Existing save behavior establishes a structured-error convention in `src/pages/api/flashcards/save.ts`, but it does not settle the new collection-specific cases. The implementer would have to invent a contract shared by the endpoint and React island.
- **Fix ⭐ Recommended**: Add a status/code table to Phase 1 and require Phase 2 to map those exact codes.
  - Strength: Makes both sides independently actionable and preserves the established structured-error pattern.
  - Tradeoff: Requires deciding the public failure taxonomy now.
  - Confidence: HIGH — the missing contract is explicit in the plan.
  - Blind spot: Exact product wording can still be refined in the UI.
- **Decision**: FIXED — added the public HTTP status/error-code matrix and required exact client mappings

### F2 — Duplicate-ID rejection can become an endless retry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1.3 — POST reconciliation semantics
- **Detail**: The plan classifies a confirmed database rejection as retryable while requiring the client to retain the same UUID. If an insert returns a duplicate-primary-key rejection, retrying that UUID repeats the same rejection indefinitely. This may represent an already-committed prior attempt or the extremely unlikely case where another owner already has that UUID. RLS makes the latter row invisible, so the cases cannot always be distinguished.
- **Fix A ⭐ Recommended**: Reconcile duplicate-key errors before classifying the outcome; return the card for an owner-visible exact match, conflict for a visible mismatch, and a non-retryable ID conflict when no row is visible.
  - Strength: Preserves retry safety and prevents an infinite loop.
  - Tradeoff: Adds one lookup for duplicate-key failures.
  - Confidence: HIGH — the current RLS and primary-key contracts support these classifications.
  - Blind spot: A cross-owner UUID collision cannot be identified as such without bypassing RLS, which the plan correctly forbids.
- **Fix B**: On duplicate-key rejection, have the client generate a new UUID before retrying.
  - Strength: Simpler server behavior.
  - Tradeoff: Could create a duplicate card if the prior insert actually succeeded but reconciliation temporarily missed it.
  - Confidence: MEDIUM — simpler, but weaker than the stated retry-safety guarantee.
  - Blind spot: Assumes reconciliation reads never produce transient misses.
- **Decision**: FIXED via Fix A — duplicate-key errors now reconcile and terminate with explicit non-retryable conflicts

### F3 — Failure-path verification lacks an executable mechanism

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy and Phases 1–3
- **Detail**: The plan makes confirmed failure, ambiguous transport, lost response, read failure, reconciliation, and conflict scenarios required evidence, but does not identify how those states will be induced. The existing development failure controls apply only to the AI save endpoint. Without an application test runner or a specified development injection mechanism, several required Progress items are not reproducible.
- **Fix**: Specify a development-only failure-injection mechanism or concrete local database/network procedure for every required failure scenario.
- **Decision**: FIXED — added deterministic development failure modes and concrete local conflict/pagination procedures
