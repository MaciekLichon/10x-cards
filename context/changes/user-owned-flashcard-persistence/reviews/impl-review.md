<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: User-owned Flashcard Persistence Implementation Plan

- **Plan**: context/changes/user-owned-flashcard-persistence/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

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

### F1 — Database contract test covers only half of the content-boundary matrix

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/tests/database/flashcards.test.sql:119
- **Detail**: The plan requires executable coverage that empty, whitespace-only, and over-10,000-character values are rejected for both `front` and `back`. The pgTAP test checks only whitespace-only `front` and overlong `back`. It also checks that `updated_at` advances, but not the planned invariants that `created_at` and `user_id` remain unchanged. The migration constraints themselves are symmetric and correct; the drift is in regression coverage.
- **Fix**: Add pgTAP assertions for empty and overlong `front`, empty and whitespace-only `back`, and preservation of `created_at` and `user_id` during update.
- **Decision**: FIXED — added the missing content-boundary and update-preservation pgTAP assertions.

### F2 — Generic trigger function can overwrite an existing schema function

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260815000000_create_flashcards.sql:12
- **Detail**: The additive migration uses `create or replace function public.set_updated_at()`. If a target database already contains that generic signature, applying this migration silently replaces it, potentially changing behavior for unrelated triggers. That weakens the plan's additive-migration guarantee even though the current local schema has no collision.
- **Fix**: Rename it to a feature-specific function such as `public.set_flashcards_updated_at()` and use plain `create function`; update the trigger and pgTAP expectation accordingly.
  - Strength: Makes an unexpected collision fail loudly and confines the helper to this table's contract.
  - Tradeoff: Requires a coordinated migration and test rename; any environment that already applied the current migration needs a follow-up migration rather than rewriting history.
  - Confidence: HIGH — the collision follows directly from PostgreSQL `CREATE OR REPLACE` semantics and the generic public-schema name.
  - Blind spot: The migration has not been applied to a hosted project according to the plan, but that external state is not independently observable here.
- **Decision**: FIXED — renamed the helper to `set_flashcards_updated_at()` and made creation collision-failing.

### F3 — Supporting ESLint overrides were not listed in the plan

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:71
- **Detail**: The implementation added narrow overrides for generated Supabase types and Node `.mjs` scripts, while `eslint.config.js` was not named under Changes Required. The additions directly support the planned generated file and RLS verifier and do not violate any “What We're NOT Doing” boundary.
- **Fix**: Record `eslint.config.js` as a supporting implementation file in the plan addendum, or consciously accept the benign extra scope.
- **Decision**: SKIPPED — benign supporting scope accepted without a plan addendum.

### F4 — Destructive policy-break manual check has no durable evidence

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/user-owned-flashcard-persistence/plan.md:339
- **Detail**: Manual criterion 3.6 is marked complete with commit `d74ddda`, but a temporary local policy break and restoration leaves no observable repository evidence. The normal RLS verifier passes in this review, but that does not independently demonstrate that the verifier failed under the deliberate break.
- **Fix**: Attach a concise redacted verification note or command transcript to the change, or explicitly accept the implementer's recorded manual confirmation.
- **Decision**: ACCEPTED — accepted the implementer's recorded manual confirmation without additional durable evidence.

## Verification Evidence

- `npm run db:reset` — PASS; migration and seed applied to the local stack.
- `npm run db:lint` — PASS; no schema errors found.
- `npm run db:test` — PASS; 38 pgTAP tests passed after triage fixes.
- `npm run db:types:check` — PASS; generated types match the committed file.
- `npm run db:verify-rls` — PASS; all owner, cross-user, and anonymous assertions passed.
- `npx astro sync` — PASS.
- `npm run lint` — PASS with 0 errors and 2 warnings in generated `worker-configuration.d.ts`.
- `npm run build` — PASS; Cloudflare-targeted server build completed, with one unrelated CSS minifier warning.
- Manual items 1.4, 1.5, 2.5, 2.6, 3.5, and 3.7 are consistent with the committed schema, generated types, client code, README, verifier output, and local-only safeguards. Item 3.6 lacks durable evidence as captured in F4.
