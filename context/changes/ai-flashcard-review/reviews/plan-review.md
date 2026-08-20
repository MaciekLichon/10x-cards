<!-- PLAN-REVIEW-REPORT -->

# Plan Review: AI Flashcard Generation and Review Implementation Plan

- **Plan**: context/changes/ai-flashcard-review/plan.md
- **Mode**: Deep
- **Date**: 2026-08-20
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | PASS    |
| Plan Completeness     | PASS    |

## Grounding

Grounding: 9/9 existing paths/parents ✓, 8/8 symbols ✓, brief↔plan ✓, Progress structure ✓

## Findings

### F1 — Retry cannot guarantee exactly one copy

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — atomic save and retry behavior
- **Detail**: A multi-row insert is atomic when validation, RLS, or the database rejects it. However, if Supabase commits successfully but the HTTP response is lost, the UI retains the proposals and retrying creates duplicates. The table generates fresh UUIDs and has no idempotency constraint. This contradicts the plan's promise that retry creates exactly one copy.
- **Fix A ⭐ Recommended**: Use client-generated card UUIDs as idempotency keys. Submit those IDs with the batch, insert them as database IDs, and after an ambiguous conflict query those IDs to distinguish “already saved” from failure.
  - Strength: Preserves predictable retry behavior without a schema migration.
  - Tradeoff: Makes transient proposal IDs part of the persistence contract and requires conflict reconciliation.
  - Confidence: HIGH — the existing UUID primary key can enforce uniqueness.
  - Blind spot: Mixed conflicts from stale or malicious IDs still require strict owner-scoped verification.
- **Fix B**: Explicitly accept ambiguous-response duplicate risk and weaken the retry success criterion.
  - Strength: Smallest MVP implementation.
  - Tradeoff: Users can create duplicate cards after a lost response.
  - Confidence: HIGH — the table has no idempotency key beyond its generated primary key.
  - Blind spot: Frequency depends on real network conditions.
- **Decision**: FIXED via Fix A — client-generated UUID idempotency keys with owner-scoped reconciliation

### F2 — OpenRouter structured-output contract is underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — OpenRouter adapter
- **Detail**: The plan allows an arbitrary configured model but says to request structured JSON “when supported.” It does not specify the endpoint, payload shape, capability enforcement, or fallback. Implementers would have to choose these during implementation.
- **Fix ⭐ Recommended**: Specify OpenRouter Chat Completions with strict `json_schema`, `provider.require_parameters: true`, parsing from `choices[0].message.content`, and treat unsupported model/provider combinations as configuration failures.
  - Strength: Provides a deterministic provider boundary with no silent downgrade.
  - Tradeoff: Restricts model selection to models and providers supporting the required parameters.
  - Confidence: HIGH — based on the current official OpenRouter structured-output contract.
  - Blind spot: Provider and model availability can change.
- **Decision**: FIXED — strict OpenRouter Chat Completions JSON Schema contract with compatible-provider enforcement

### F3 — Required secrets conflict with graceful diagnostics

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — provider configuration
- **Detail**: The plan makes both OpenRouter fields required while also extending `config-status.ts` to report missing values. Required Astro environment fields may fail during module loading before the diagnostic banner or endpoint error can render. That banner is global through `Layout.astro`, so missing AI configuration could also affect non-AI pages. `OPENROUTER_MODEL` is configuration rather than a credential.
- **Fix ⭐ Recommended**: Make AI fields optional at the Astro schema boundary, validate them inside the generation endpoint, store only `OPENROUTER_API_KEY` as a Worker secret, configure `OPENROUTER_MODEL` as a server-side variable, and scope the missing-AI notice to the dashboard.
  - Strength: Builds and unrelated pages remain usable without AI configuration.
  - Tradeoff: Configuration validity is enforced at request time instead of application startup.
  - Confidence: HIGH — grounded in the current global config-status call path.
  - Blind spot: Deployment tooling may still need a separate preflight check.
- **Decision**: FIXED — optional Astro AI fields, endpoint validation, API-key-only secret, and dashboard-scoped notice

### F4 — Failure simulations are not reproducible

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Manual verification matrix
- **Detail**: The plan requires manually simulating timeouts, malformed provider output, and database failures, but provides no reproducible mechanism. An implementer would need to invent temporary production-code edits or wait for external failures.
- **Fix**: Document a development-only adapter substitution or a small manual verification script that produces each failure deterministically without adding a test runner.
- **Decision**: FIXED — documented DEV-only fault modes for deterministic provider, save, and lost-response checks
