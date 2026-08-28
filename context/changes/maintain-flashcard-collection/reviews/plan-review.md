<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Maintain Flashcard Collection

- **Plan**: `context/changes/maintain-flashcard-collection/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-28
- **Verdict**: SOUND
- **Findings**: 0 critical, 4 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 8/8 existing paths ✓, 3 planned-new paths ✓, 5/5 symbols ✓, brief↔plan ✓. Progress contract: 3/3 phases ✓, 29/29 criteria mapped ✓.

## Findings

### F1 — Reconciliation can stop before restoring loaded pages

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Implementation Approach; Phase 2.1
- **Detail**: The plan permits refresh to stop when it passes the target card, even if the target is on an early page. That can discard later pages which were already loaded, contradicting the promise to rebuild the authoritative loaded window and preserve later-page collection integrity. Cursor depth alone is not a stable boundary when concurrent creation or deletion changes page composition. The client has the required tuple in each DTO (`src/lib/flashcards.ts:23-34`), while GET uses stable tuple ordering (`src/pages/api/flashcards/collection.ts:83-103`).
- **Fix**: Capture the old final loaded `(createdAt, id)` boundary. Re-fetch with ID deduplication until that boundary is reached or passed. The target position may classify the mutation early, but must not terminate rebuilding before the boundary.
  - Strength: Preserves authoritative coverage through the loaded window and satisfies the later-page criterion.
  - Tradeoff: More reads when the target appears near the front.
  - Confidence: HIGH — the existing DTO and cursor order expose the required tuple.
  - Blind spot: Cursor traversal is not a database snapshot, so define boundary coverage rather than identical old membership during concurrent inserts/deletes.
- **Decision**: FIXED — captured the final loaded stable boundary, required deduplicated traversal through it, and clarified authoritative boundary coverage semantics.

### F2 — One active mutation conflicts with enabled unrelated cards

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Desired End State; Phase 2.1–2.3
- **Detail**: The plan tracks “one active mutation” while promising that only the active card is blocked and unrelated card actions remain usable. If another card starts a mutation, singular mutation state cannot represent both operations safely. If its controls cannot start a mutation, the “only active card is blocked” promise is inaccurate.
- **Fix A ⭐ Recommended**: Support concurrent mutations with state keyed by card ID, while retaining a single active editor.
  - Strength: Directly satisfies the stated per-card isolation and keeps independent actions responsive.
  - Tradeoff: Reconciliation and focus recovery must tolerate overlapping results.
  - Confidence: HIGH — the plan already calls for per-card mutation state.
  - Blind spot: Creation and pagination still need explicit rules while any reconciliation replaces list state.
- **Fix B**: Serialize all mutations and disable other cards’ mutation controls while one is running.
  - Strength: Considerably simpler state and reconciliation model.
  - Tradeoff: Requires revising the desired end state and manual criterion that only the active card is blocked.
  - Confidence: HIGH — it extends the collection’s existing serialized-operation approach.
  - Blind spot: Editing a draft on another card could remain usable even if its Save/Delete controls are disabled.
- **Decision**: FIXED via Fix B — serialized card mutations and disabled mutation controls on non-active cards while one mutation is pending.

### F3 — Conflict classification is not atomic

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1.2 — Owner-scoped resource mutations
- **Detail**: The planned mutation followed by an owner-scoped lookup is two database statements. A concurrent update or deletion between them can change the classification from conflict to not-found. The implementation must also avoid `.single()` on the conditional mutation because zero rows becomes a PostgREST error instead of the intended classification branch (`scripts/verify-flashcard-rls.mjs:123-167`).
- **Fix A ⭐ Recommended**: Keep the two-query design, explicitly define classification as based on the owner-visible state at follow-up, and require `.select(...)` with array-length inspection or `.maybeSingle()`.
  - Strength: No schema migration; preserves the lean S-04 scope.
  - Tradeoff: Concurrent deletion can legitimately surface as 404 instead of 409.
  - Confidence: HIGH — supported by current RLS and Supabase behavior.
  - Blind spot: Manual timing tests cannot reliably exhaust every interleaving.
- **Fix B**: Add a database RPC that performs mutation and classification atomically.
  - Strength: Truly deterministic conflict classification.
  - Tradeoff: Introduces a migration, generated-type change, and security-definer/RLS design work excluded by the current plan.
  - Confidence: MEDIUM — feasible, but its security contract has not been designed.
  - Blind spot: RPC privilege and information-disclosure behavior require separate review.
- **Decision**: FIXED via Fix A — retained the two-query design, defined follow-up-visible classification semantics, and required safe zero-row result handling without `.single()`.

### F4 — Delete dialog implementation primitive is unresolved

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2.4 — Delete confirmation
- **Detail**: The repository has no dialog component, focus-trap utility, or dialog dependency. Its existing discard confirmation uses `window.confirm` (`src/components/flashcards/FlashcardWorkspace.tsx:72`). Phase 2 requires modal isolation, focus management, Escape handling, conditional restoration, and deletion unmount behavior, but does not select an implementation primitive. ESLint cannot verify these runtime behaviors.
- **Fix A ⭐ Recommended**: Specify native `<dialog>` with `showModal()`, explicit Cancel initial focus, controlled close/Escape handling, and documented focus restoration after cancel versus deletion.
  - Strength: Browser-provided modal isolation and focus behavior without another dependency.
  - Tradeoff: React lifecycle and post-deletion focus still require careful implementation and manual verification.
  - Confidence: HIGH — current target is a modern desktop browser.
  - Blind spot: The project’s exact browser support floor is not documented.
- **Fix B**: Add a vetted accessible dialog primitive and name it in the plan and dependency changes.
  - Strength: Mature focus management and fewer custom accessibility edge cases.
  - Tradeoff: Adds dependency weight and a new UI-system pattern.
  - Confidence: MEDIUM — no candidate dependency has been evaluated.
  - Blind spot: Styling fit and bundle impact remain unmeasured.
- **Decision**: FIXED via Fix A — selected native `<dialog>` with `showModal()`, safe initial focus, controlled cancellation, lifecycle guards, and outcome-specific focus restoration.
