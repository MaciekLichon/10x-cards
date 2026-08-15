<!-- PLAN-REVIEW-REPORT -->

# Plan Review: User-owned Flashcard Persistence Implementation Plan

- **Plan**: `context/changes/user-owned-flashcard-persistence/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-15
- **Verdict**: SOUND
- **Findings**: 1 critical, 4 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | PASS    |

## Grounding

5/5 path contracts verified, 6/6 referenced symbols verified, and the brief matches the revised plan. The installed
Supabase CLI supports database reset, enforcing lint, local type generation, and pgTAP database tests. The existing
`createServerClient` accepts the planned generated `Database` generic, with only auth-method callers in the current
blast radius.

## Findings

### F1 — Progress titles do not exactly match success criteria

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: All phases — Success Criteria and Progress
- **Detail**: Several Progress rows omitted commands or rephrased the corresponding criteria, violating the mechanical
  plan-progress mapping.
- **Fix**: Copy every complete Success Criteria title into its numbered Progress row without changing numbering or state.
- **Decision**: FIXED

### F2 — Local-only verification is documented but not enforced

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Two-user RLS integration check
- **Detail**: The verification script requires `SUPABASE_URL` but does not programmatically reject a hosted project, so
  an incorrectly configured environment could receive transient test users and rows.
- **Fix**: Abort before mutation unless the configured URL uses a loopback hostname.
- **Decision**: SKIPPED — user could not confidently select the restriction during this review

### F3 — Schema behavior is promised without an executable test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 and Testing Strategy
- **Detail**: Content constraints, timestamp behavior, cascade deletion, and schema metadata lacked an executable backing
  artifact; the ordinary-client RLS script cannot delete auth users to prove cascade behavior.
- **Fix**: Add `supabase/tests/database/flashcards.test.sql` using pgTAP and run it with `npx supabase test db`, while
  retaining the real-client RLS proof.
- **Decision**: FIXED

### F4 — Database lint does not enforce failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Automated Verification
- **Detail**: `supabase db lint` defaults to `--fail-on none`, allowing reported errors to exit successfully.
- **Fix**: Run `npx supabase db lint --local --fail-on error`.
- **Decision**: FIXED

### F5 — The owner index is not assigned to an implementation contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 and Performance Considerations
- **Detail**: The brief and performance section required a `user_id` index, but the migration contract did not instruct
  the implementer to create or test it.
- **Fix**: Add `flashcards(user_id)` to the migration contract and pgTAP assertions.
- **Decision**: FIXED
