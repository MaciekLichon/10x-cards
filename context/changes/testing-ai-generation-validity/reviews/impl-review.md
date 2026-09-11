<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI generation validity

- **Plan**: `context/changes/testing-ai-generation-validity/plan.md`
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-09-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Fetch mocks can conceal request-routing regressions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `tests/integration/flashcards/FlashcardWorkspace.test.tsx:42`
- **Detail**: The workspace helper returns queued responses for any URL, method, headers, or body, although the plan and cookbook say the suite stubs only `/api/flashcards/generate`. The suite could remain green after a regression to the wrong endpoint or request shape. A related in-band URL assertion in `tests/integration/flashcards/generate.test.ts:28` can be caught and normalized into the expected `provider_failure`, allowing the two provider-failure cases to pass for the wrong reason.
- **Fix**: Make the workspace mock fail closed unless it receives `/api/flashcards/generate` with POST and JSON, and verify provider URL calls outside the mocked transport implementation.
  - Strength: Turns routing and request shape into independently observable contract evidence and removes the false-positive path.
  - Tradeoff: Requires a small shared assertion helper and updates to call assertions in both integration suites.
  - Confidence: HIGH — the permissive mock and caught in-band assertion are directly visible in the current test helpers.
  - Blind spot: The plan does not require exact prompt-body assertions in every workspace scenario, so source-payload depth still needs a scoped choice.
- **Decision**: SKIPPED

### F2 — Live review records an ambiguous model label

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `tests/quality/ai-generation/reviews/2026-09-11-conditions-pl.md:10`
- **Detail**: The review records `Nex-N2.5-Mini (free)`, a display label rather than the exact configured `OPENROUTER_MODEL` identifier required by the review template and procedure. Display labels and free aliases may be ambiguous or mutable, weakening reproducibility of the retained evidence.
- **Fix**: Replace the label with the exact non-secret provider/model slug used for the run, optionally retaining the display label as a separate note.
- **Decision**: FIXED — recorded the configured `openrouter/free` router, preserved the observed display label, and
  explicitly documented that the routed model slug was not captured.

### F3 — Change brief contradicts the final live-review requirement

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/testing-ai-generation-validity/change.md:57`
- **Detail**: The original Q4 decision still says the first live review is deferred and not required for completion. The later reviewed plan explicitly supersedes that decision and requires the live run, which the implementation completed. Future agents reading the sibling brief may follow stale guidance.
- **Fix**: Add a dated superseding note that preserves the original decision as history and points to the plan-review expansion.
- **Decision**: FIXED — preserved the original Q4 decision and added a dated note documenting the superseding
  plan-review decision.

### F4 — Frozen test-plan sections received unplanned formatting rewrites

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `context/foundation/test-plan.md:15`
- **Detail**: The plan permits cookbook updates in §6.1 and §6.2 but says not to rewrite frozen §§1–5 or §7. Commit `8773a09` reformatted emphasis and tables throughout §§1–5. The changes are formatting-only and preserve meaning; §7 was untouched.
- **Fix**: Revert only the formatting hunks in §§1–5 while retaining the substantive §6.1 and §6.2 cookbook updates.
- **Decision**: FIXED — restored the pre-implementation formatting in frozen §§1–5 while retaining the completed
  cookbook content in §6.

### F5 — DOM Testing Library range differs from the plan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `package.json:53`
- **Detail**: Phase 2 specifies `@testing-library/dom ^10`, while the manifest pins exactly `10.4.1`. The resolved version is compatible and the cookbook accurately records it, so this does not affect current behavior, but it is a literal dependency-contract deviation.
- **Fix**: Change the manifest range to `^10.4.1`, or document the exact pin as an intentional plan deviation.
- **Decision**: SKIPPED

## Verification

- `npm run test -- tests/integration/flashcards/generate.test.ts` — PASS, 24 tests.
- `npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx` — PASS, 13 tests.
- `npm run test` — PASS, 37 tests across 2 files.
- `npx astro sync` — PASS.
- `npm run lint` — PASS with 4 existing warnings and 0 errors.
- `npx astro check` — PASS outside the restricted sandbox after the sandboxed run could not bind the Cloudflare inspector port; 0 errors, 7 hints.
- `npm run build` — PASS; build emitted one CSS-minifier warning for an unrelated generated arbitrary class.
- `npx prettier --check tests/quality/ai-generation/*.md README.md context/foundation/test-plan.md` — PASS.
- All three trimmed source texts are within 1,000–10,000 characters: 1,890; 2,001; and 1,801 characters.
- Manual criteria 3.4–3.7 have observable evidence in the approved reference record, full seven-card review, failed-batch follow-up change, and cookbook. No rubber-stamped manual item was identified.

## Triage Summary

- **Date**: 2026-09-12
- **Fixed**: F2, F3, F4
- **Skipped**: F1, F5
- **Accepted as project rules**: none
- **Residual verdict**: NEEDS ATTENTION — F1 remains a skipped, unfixed warning; F5 is a skipped observation.
