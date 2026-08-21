<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: AI Flashcard Generation and Review Implementation Plan

- **Plan**: context/changes/ai-flashcard-review/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Network insert failures bypass reconciliation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/save.ts:73
- **Detail**: The plan requires ambiguous insert outcomes to be reconciled by submitted ID. Supabase PostgREST catches non-throwing fetch failures and returns `{ error, status: 0 }`, but the endpoint treats every returned `error` as a confirmed failure and reconciles only thrown exceptions. A lost response after commit can therefore be reported as retryable `save_failed`, risking a duplicate/conflict retry instead of owner-scoped reconciliation.
- **Fix**: Inspect the returned status and call `reconcileSave` for transport-level results such as `status === 0`; reserve `save_failed` for confirmed database responses.
  - Strength: Preserves the planned distinction between confirmed failure and ambiguous commit while matching the installed Supabase client's actual error contract.
  - Tradeoff: Adds a small classification branch and relies on the SDK's documented result shape.
  - Confidence: HIGH — the installed `PostgrestBuilder` converts caught fetch failures to an error result with status 0.
  - Blind spot: Upstream gateway failures with a nonzero HTTP status may still require a policy decision about whether they are confirmed or ambiguous.
- **Decision**: FIXED — transport-level insert failures (`status === 0`) now use owner-scoped reconciliation.

### F2 — Edited duplicate questions remain saveable in the UI

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/flashcards/FlashcardWorkspace.tsx:55
- **Detail**: Client validity checks only nonempty and 200/500 length rules. If a user edits two accepted questions to the same normalized text, both remain counted as valid and Save stays enabled, although the server rejects the entire batch as `invalid_proposals`. The UI error mentions duplicates but does not identify or prevent them.
- **Fix**: Compute normalized question keys across accepted proposals, mark every duplicate card invalid, surface a field-level duplicate message, and exclude duplicates from the saveable count.
  - Strength: Makes the review UI match the server's canonical validation and prevents a predictable whole-batch rejection.
  - Tradeoff: Requires coordinated changes across workspace/list/card validation rather than a one-line guard.
  - Confidence: HIGH — the mismatch is directly reproducible from the client and server validation paths.
  - Blind spot: None significant.
- **Decision**: ACCEPTED — client-side duplicate guidance is deferred; server-side validation safely rejects duplicate batches without persistence.

### F3 — Paid generation has no server-side abuse limit

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards/generate.ts:11
- **Detail**: The plan explicitly defers rate limiting, but every authenticated same-origin request can trigger a paid OpenRouter call with up to 4,000 output tokens. Same-origin and authentication limit casual cross-site abuse, not direct scripted requests from a compromised or disposable account, leaving spend and provider load unbounded at the application boundary.
- **Fix A ⭐ Recommended**: Add a bounded per-user generation quota/concurrency guard before calling OpenRouter.
  - Strength: Controls cost at the same authenticated boundary that initiates paid work.
  - Tradeoff: Expands this MVP beyond its stated non-goals and requires choosing storage, limits, and reset semantics.
  - Confidence: HIGH — the endpoint currently has no application-side request accounting or concurrency control.
  - Blind spot: Available Cloudflare/provider-native controls and the intended launch audience have not been verified.
- **Fix B**: Keep rate limiting deferred but enforce a provider-side hard spend cap and record the accepted launch risk with a follow-up owner.
  - Strength: Preserves current implementation scope while bounding financial exposure operationally.
  - Tradeoff: Does not provide fair per-user throttling and may turn abuse into a service-wide outage when the cap is reached.
  - Confidence: MEDIUM — effectiveness depends on current OpenRouter account controls and alerting.
  - Blind spot: Provider budget configuration is outside this repository and was not inspected.
- **Decision**: ACCEPTED — the MVP uses free OpenRouter models, so the remaining exposure is provider quota and availability rather than direct token spend; application rate limiting is deferred.

### F4 — Manual completion claims have no reviewable evidence

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ai-flashcard-review/plan.md:411
- **Detail**: All 15 manual criteria are checked and stamped with phase commit SHAs, but the change contains no content-free execution notes or result matrix that a reviewer can inspect. Code structure supports many claims, but browser behavior, boundary exercises, failure-mode simulations, cross-user checks, and log/history retention cannot be independently confirmed from the diff.
- **Fix**: Add a concise, non-sensitive manual verification record listing date/environment and pass/fail per scenario without source text, generated content, credentials, or screenshots containing user data.
- **Decision**: FIXED — added `reviews/manual-verification.md` with a non-sensitive scenario matrix and verification results.
