<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Personal Flashcard Collection Implementation Plan

- **Plan**: context/changes/personal-flashcard-collection/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification Evidence

| Command or criterion | Result | Evidence |
|---|---|---|
| `npm run db:reset` | PASS | Local database recreated and both migrations applied. |
| `npm run db:lint` | PASS | No schema errors found. |
| `npm run db:test` | PASS | 39 pgTAP tests passed. |
| `npm run db:types:check` | PASS | Generated database types match the checked-in file. |
| `npm run db:verify-rls` | PASS | Owner, second-user, and anonymous isolation checks passed. |
| `npx astro sync` | PASS | Route and environment types generated. |
| `npm run lint` | PASS | Zero errors; four pre-existing warnings outside this change. |
| `npm run build` | PASS | Cloudflare-targeted server build completed. |
| Manual criteria | PASS | All checked items have content-free evidence in `reviews/manual-verification.md`; VoiceOver was not exercised and is disclosed. |

## Findings

### F1 — Cursor parser accepts non-ISO timestamps

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/flashcards.ts:99
- **Detail**: The plan requires a validated ISO timestamp and rejection of malformed or non-date cursor values. `new Date(candidate.createdAt)` accepts non-ISO forms such as a date-only string and line 103 silently normalizes them with `toISOString()`, so the parser is more permissive than the planned cursor contract.
- **Fix**: Require `candidate.createdAt` to equal the canonical `new Date(candidate.createdAt).toISOString()` value after validating the date, rejecting non-canonical timestamps.
- **Decision**: FIXED

### F2 — Manual-card parser accepts unknown payload properties

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/flashcards.ts:59
- **Detail**: The planned request shapes are strict `{ id, front, back }` and `{ id, front, back, reconcile: true }`, and the API says it never accepts `user_id`. The parser validates required fields but allows arbitrary extra keys, including `user_id`. The endpoint safely discards extras before insert, so this is contract drift rather than an ownership bypass.
- **Fix**: Reject keys outside `id`, `front`, `back`, and the endpoint-controlled optional `reconcile`, and require `reconcile` to be exactly `true` when present.
- **Decision**: SKIPPED — accepted low immediate risk; unknown fields are currently discarded and ownership remains session-derived.

### F3 — Stale pagination can overwrite a post-save refresh

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/flashcards/FlashcardCollection.tsx:74
- **Detail**: `loadMore()` may remain in flight while a successful save starts `loadFirstPage(true)`. If the older pagination response completes after the first-page refresh, it appends results based on the pre-save cursor and overwrites `nextCursor`, which can duplicate, reorder, or skip cards. The Load More action is not disabled by saving or first-page refresh, and active pagination is not invalidated.
- **Fix ⭐ Recommended**: Use a collection-read generation token so only responses from the current generation can commit state.
  - Strength: Prevents stale commits for both user-triggered and future overlapping reads without depending solely on button state.
  - Tradeoff: Adds a ref and generation checks to both read paths.
  - Confidence: HIGH — the race follows directly from independent asynchronous setters in the two read paths.
  - Blind spot: Network timing was not deterministically exercised in the recorded manual matrix.
- **Fix B**: Serialize the current UI paths by disabling Load More while saving or refreshing and refusing `loadMore()` during those states.
  - Strength: Smaller behavioral change and prevents the currently reachable overlap.
  - Tradeoff: State closures can be subtle, and this protects fewer future overlapping-read paths than response invalidation.
  - Confidence: MEDIUM — sufficient for current controls, but less robust as the component evolves.
  - Blind spot: Programmatic or future call paths could reintroduce overlapping reads.
- **Decision**: FIXED via Fix B — current UI paths serialize saving, first-page loading, and pagination.
