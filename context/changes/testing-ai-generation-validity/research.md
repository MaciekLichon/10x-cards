---
date: 2026-09-08T22:34:18+02:00
researcher: Codex
git_commit: 61a4f5e1b217bbbf519765d485fb59de0bd8bc46
branch: main
repository: 10x-cards
topic: "Ground rollout Phase 1: AI generation validity and source fidelity"
tags: [research, codebase, testing, ai-generation, source-fidelity]
status: complete
last_updated: 2026-09-08
last_updated_by: Codex
---

# Research: AI generation validity and source fidelity

**Date**: 2026-09-08T22:34:18+02:00  
**Researcher**: Codex  
**Git Commit**: 61a4f5e1b217bbbf519765d485fb59de0bd8bc46  
**Branch**: main  
**Repository**: 10x-cards

## Research Question

Ground rollout Phase 1 of [the quality contract](../../foundation/test-plan.md), using
[the change brief](change.md): trace actual invalid-generation failure paths and UI recovery, locate existing
verification, and identify the cheapest useful protection for risks #1 and #2.

Scope is research for planning. No application changes, test code, runner installation, provider calls, or CI changes
were performed. Findings are static code observations, supplemented by historical records and current documentation;
they are not newly executed runtime proofs. No foundation lessons file was present.

## Summary

- Risk #1 has a concrete boundary: invoke the real generation endpoint, provider adapter, and proposal validator while
  replacing only the external OpenRouter fetch. Add focused React component integration checks for recovery.
- Invalid provider envelopes produce recoverable errors. Invalid individual cards are discarded; valid survivors remain
  usable. A batch of one to four cards succeeds. Rejecting every imperfect batch would contradict the accepted contract.
- Failure retains source text and previous edited proposals; successful retry replaces proposals. This is observable
  through the workspace component without requiring an Astro page or browser journey.
- Risk #2 remains a hypothesis. Structural validation cannot establish source fidelity. No replayable fidelity corpus
  or independent human labels exist. A small human-reviewed sample set is the cheapest initial semantic signal.
- The sparse-result notice makes an unsupported inference about source richness. Plan neutral count-based wording;
  do not lock that inference into tests.
- No blocker requires returning to the test-plan orchestrator. These findings refine Phase 1 without changing frozen
  strategy, risk identifiers, or exclusions.

## Detailed Findings

### 1. Actual generation boundary

The dashboard mounts a React island ([src/pages/dashboard.astro:48](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/pages/dashboard.astro#L48)).
Its generation action posts source text to the endpoint. The endpoint checks same origin, a populated
`locals.user`, JSON content type/body, trimmed source length, and configured provider values before calling
the provider adapter ([src/pages/api/flashcards/generate.ts:11](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/pages/api/flashcards/generate.ts#L11)).

The route itself performs no database operations. A direct route test can supply a real Request with matching Origin,
JSON headers, valid source, and a minimal authenticated locals fixture. This exercises the handler contract, not
middleware/session authentication or database ownership; those remain later-phase concerns.

The provider request asks for structured JSON, standalone non-overlapping same-language cards, and no filler.
The actual response boundary is a fetch to OpenRouter, followed by outer JSON decoding, first-choice content extraction,
inner JSON decoding, and application validation ([src/lib/openrouter.ts:39](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L39),
[src/lib/openrouter.ts:98](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L98)).

Provider fixtures must use the real envelope:

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"proposals\":[{\"question\":\"What is the sample rule?\",\"answer\":\"The independently specified rule.\"}]}"
      }
    }
  ]
}
```

A top-level provider `proposals` fixture skips the actual protocol. Keep the development failure mode unset:
the shortcuts at [src/lib/openrouter.ts:27](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L27) bypass fetch/decoding and cannot demonstrate malformed-output protection.

### 2. Observable response matrix

| Provider boundary input                                                                                                 | Current endpoint result            | Planning implication                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| HTTP success with invalid outer JSON, missing/empty choices, missing message, non-string content, or invalid inner JSON | 502 `malformed_output`             | Cover representative envelope and content failures.                  |
| Decoded null/primitive, absent/non-array proposals, empty proposals, or all unusable candidates                         | 422 `no_usable_proposals`          | Distinguish unreadable from readable-but-unusable output.            |
| Mixed invalid and valid candidates                                                                                      | 200 with valid survivors           | Assert exact independently authored survivors and order.             |
| One to four valid survivors                                                                                             | 200 with `sparse: true`            | Sparse output is success, not an error.                              |
| Five to fifteen valid survivors                                                                                         | 200 with `sparse: false`           | Include a usable normal batch.                                       |
| More than fifteen usable distinct candidates                                                                            | First fifteen retained             | Verify output cap without requiring the whole batch to fail.         |
| Fetch rejects with TimeoutError/AbortError                                                                              | 504 `provider_timeout`             | Test application mapping without waiting 17 seconds.                 |
| Other fetch rejection or non-OK provider response except 400/404                                                        | 502 `provider_failure`             | A transport failure and representative provider failure suffice.     |
| Provider 400/404                                                                                                        | 503 `unsupported_ai_configuration` | Document surrounding behavior; avoid a configuration-specific suite. |

Evidence: [src/lib/openrouter.ts:85](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L85), [src/lib/flashcards.ts:217](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/flashcards.ts#L217),
[src/pages/api/flashcards/generate.ts:44](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/pages/api/flashcards/generate.ts#L44).

The parser trims strings, rejects empty/oversized/non-string fields, discards punctuation-only questions,
deduplicates normalized questions, and retains the first usable occurrence. Normalization is NFKC, lowercase, and
punctuation-to-spaces ([src/lib/flashcards.ts:58](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/flashcards.ts#L58)). Extra properties are discarded rather than rejected.
This is a deliberately tolerant consumer despite the strict requested provider schema.

Source bounds are 1,000–10,000 after trimming; question/answer maxima are inclusive 200/500
([src/lib/flashcards.ts:49](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/flashcards.ts#L49), [src/lib/flashcards.ts:232](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/flashcards.ts#L232)).
The accepted implementation plan independently specifies these limits
([context/changes/ai-flashcard-review/plan.md:128](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/changes/ai-flashcard-review/plan.md#L128)). Use literal boundary fixtures rather than deriving
expected values from production constants or reproducing the normalizer in tests. The prompt says “under” whereas
schema and application enforce inclusive maxima; document the accepted inclusive contract.

Two narrower observations do not require expanding the initial suite: only the first provider choice is examined;
a timeout while reading the response body is caught as malformed output, whereas a timeout during fetch is classified
as provider timeout. Neither is evidence of a reported incident.

### 3. UI recovery and usable cards

At generation start the workspace clears the error and marks itself busy, but does not clear source or existing
proposals. It confirms replacement when proposals already exist. Only a successful response installs new proposal IDs
and accepted defaults; failure shows a known or generic message and exits busy state
([src/components/flashcards/FlashcardWorkspace.tsx:70](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/FlashcardWorkspace.tsx#L70)).

The useful component scenarios are:

1. Invalid source prevents a request. During a pending valid request, input/generation/edit/save controls are disabled.
2. Failure produces an accessible alert, retains source, stops loading, and permits retry.
3. Failure followed by success clears the error and displays editable, initially accepted cards with save available.
4. Edited/partly rejected proposals survive a confirmed regeneration failure. A later success replaces the set.
   Canceling replacement confirmation makes no request.
5. Sparse success displays the returned cards and a notice, without treating count as proof of fidelity.

Use the actual workspace and child components. Error-code variants can share parameterized assertions; do not repeat
all parser cases in the UI suite. A stubbed endpoint response is appropriate for focused UI recovery, while the route
suite proves those response guarantees with the real validator. If composing both in one harness, dispatch the UI's
relative request into the actual handler and stub only the provider URL; do not recursively forward every fetch.

Evidence: [src/components/flashcards/FlashcardWorkspace.tsx:54](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/FlashcardWorkspace.tsx#L54),
[src/components/flashcards/FlashcardWorkspace.tsx:177](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/FlashcardWorkspace.tsx#L177),
[src/components/auth/ServerError.tsx:11](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/auth/ServerError.tsx#L11),
[src/components/flashcards/ProposalCard.tsx:106](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/ProposalCard.tsx#L106).

Saving durability, edited-question duplication, reconciliation, and ownership remain Phase 2.
“Usable” here means reviewable/editable/selectable, not proven persisted.

### 4. Source fidelity and independent review

The validator receives only generated proposals, not source text
([src/lib/openrouter.ts:119](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L119)). It cannot prove factual support, preserved qualifiers, source language,
standalone answerability, or conceptual overlap. A syntactically valid false answer can pass this boundary; that is
a limitation of structural validation, not an observed provider hallucination.

The PRD requires useful source-derived learning material and user review
([context/foundation/prd.md:47](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/foundation/prd.md#L47), [context/foundation/prd.md:74](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/foundation/prd.md#L74)).
Its 75% acceptance target is a product outcome, not a ready-made fidelity pass threshold
([context/foundation/prd.md:33](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/foundation/prd.md#L33)).

Proposed Phase 1 sample procedure, to be made concrete in planning:

- Have a human author or explicitly validate three small synthetic programmer-learning passages within the source limits:
  ordinary factual material, conditions/negation/exceptions, and sparse few-concept material. Include Polish and English
  across samples. These categories follow the persona, source-language requirement, and sparse-output contract.
- Before generation, record independent expected facts, passage anchors, acceptable paraphrases, and forbidden
  contradictions/inventions. AI-authored drafts alone are not independent human labels.
- Review every returned card in each tiny batch for source support, standalone answerability, qualifier preservation,
  one concept, semantic overlap, source language, and usefulness. Record accept/edit/reject and reasons.
- Report unsupported/contradictory answers as failed cards, alongside missing important concepts and actual batch size.
  Do not require exact wording or a fixed number of cards; a batch-level threshold is a planning policy still to choose.
- Store synthetic samples and intentionally retained review evidence with sample revision, date, and model identity.
  This does not authorize retaining production users' source material.
- Human review is sufficient initially. Add advisory AI only if comparison against human-labeled faithful and corrupted
  examples demonstrates additional useful findings; record disagreements and human resolution.
  **When NOT to use AI assistance:** deterministic format checks, cheap human review, or uncalibrated judgments.
  Live-provider runs remain selective and are never required per edit.

No corpus, expected-fact inventory, or semantic rubric was found. The previous manual matrix reports PASS but retained
neither source nor generated content, so it cannot be replayed or independently rescored
([context/changes/ai-flashcard-review/reviews/manual-verification.md:5](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/changes/ai-flashcard-review/reviews/manual-verification.md#L5)).

### 5. Minimal runner feasibility and existing verification

The manifest has no application runner or application test command. Existing verification comprises two SQL suites and
three scripts for database ownership and spaced repetition. Their presence does not cover generation validity
([package.json:13](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/package.json#L13)).

| Existing artifact                                    | Relevant scope                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `supabase/tests/database/flashcards.test.sql`        | 45 declared pgTAP assertions for schema, constraints, ownership |
| `supabase/tests/database/spaced_repetition.test.sql` | 50 declared pgTAP assertions for review database behavior       |
| `scripts/verify-flashcard-rls.mjs`                   | Local persistence/ownership                                     |
| `scripts/verify-fsrs-scheduler.mjs`                  | Scheduler adapter                                               |
| `scripts/verify-spaced-repetition.mjs`               | Review-state integration                                        |

Lockfile inspection: Astro 6.3.1, React 19.2.6, Cloudflare adapter 13.7.0, Vite 7.3.3.
Local Node is 22.18.0. Vitest and jsdom are absent. The manifest overrides Vite to ^7.3.2
([package.json:69](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/package.json#L69)).

**Documentation checked: 2026-09-08, through Context7.** Official Astro docs retain `getViteConfig`; Astro 6 requires
server environments for rendering Astro components. That restriction does not require this React island's component
tests to render Astro.
See [Astro testing](https://docs.astro.build/en/guides/testing/) and
[Astro 6 testing constraints](https://docs.astro.build/en/guides/upgrade-to/v6/).

Vitest **4.1.6 is a documented candidate**, not an installed or proven selection. Its versioned guide specifies
Node >=20 and Vite >=6, compatible with the observed versions at that level. The unversioned Context7 result included
Vitest 5 development material, so it was not used as a release recommendation.
See [versioned installation guide](https://github.com/vitest-dev/vitest/blob/v4.1.6/docs/guide/index.md)
and [virtual-module mocking](https://github.com/vitest-dev/vitest/blob/v4.1.6/docs/guide/mocking/modules.md).

Recommended planning direction:

- Standalone Vitest setup for Node route/contract checks and a DOM environment for the focused React recovery checks.
  Retain JSX transforms and the `@/` alias. Choose a compatible DOM package at implementation time.
- Resolve `astro:env/server` to explicit test-only exports with dummy provider credentials and failure mode unset.
  This isolates runtime configuration; keep application handlers, provider decoding, and validators real.
- Do not load the Cloudflare adapter or render Astro merely to test a TypeScript handler and React component.
  Runtime deployment fidelity and cookie/browser crossings are separate concerns.
- Add a documented application-test command before introducing tests. Preserve existing lint/type/build checks and
  `deploy:check`; do not add a configuration suite, browser infrastructure, or CI pipeline.
- Verify final package compatibility and the minimal harness during implementation. No install or runner spike was
  performed in this research. No new command is claimed to exist yet.

## Response-Guidance Corrections and Speculative Risks

| Finding                                                                  | Classification                                          | Recommended response                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Mixed output is salvaged; one to four cards succeeds                     | Established contract                                    | Refine “invalid output fails” to distinguish unusable batches from invalid individual cards.                        |
| Sparse notice claims few source concepts and no filler                   | Observed unsupported inference                          | Plan neutral wording such as “Fewer than five proposals were returned. Review them against your source.”            |
| Structurally valid cards could misrepresent meaning                      | Hypothesis; no retained semantic evidence               | Use independent samples and human review.                                                                           |
| Client trusts typed response rather than validating every field          | Observed trust boundary; breach hypothetical            | Prove server output guarantee first, rather than inventing malformed-success UI cases as known production failures. |
| Previously saved proposals can become editable after failed regeneration | Adjacent state behavior; duplicate persistence unproven | Leave durable-save implications to Phase 2.                                                                         |

The sparse notice at [src/components/flashcards/ProposalList.tsx:38](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/ProposalList.tsx#L38) relies only on the count-based
`sparse` flag. The earlier plan explicitly requested this explanation
([context/changes/ai-flashcard-review/plan.md:75](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/changes/ai-flashcard-review/plan.md#L75)); it is inherited reasoning, not implementation drift.
It can be corrected within Phase 1 planning without refreshing the frozen risk strategy.

The client accepts a truthy `proposals` value without runtime shape checks
([src/components/flashcards/FlashcardWorkspace.tsx:82](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/FlashcardWorkspace.tsx#L82)).
An injected empty array could enter reviewing with zero cards, and invalid entries could fail while rendering.
The actual handler prevents these outputs through its validator. Do not present synthetic endpoint contract violations
as established provider-path bugs.

## Code References

- [src/pages/api/flashcards/generate.ts:11](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/pages/api/flashcards/generate.ts#L11) — request guards and route boundary.
- [src/pages/api/flashcards/generate.ts:53](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/pages/api/flashcards/generate.ts#L53) — public failure mappings.
- [src/lib/openrouter.ts:98](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/openrouter.ts#L98) — provider envelope and content decoding.
- [src/lib/flashcards.ts:217](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/lib/flashcards.ts#L217) — filtering, deduplication, cap, and success condition.
- [src/components/flashcards/FlashcardWorkspace.tsx:70](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/FlashcardWorkspace.tsx#L70) — generation and recovery state transitions.
- [src/components/flashcards/ProposalList.tsx:33](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/src/components/flashcards/ProposalList.tsx#L33) — sparse notice.
- [package.json:23](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/package.json#L23) — existing local validation gate.

## Architecture Insights

The useful test seam crosses several production modules, rather than stopping at a parser helper.
Transport fixtures prove application validation and response mapping; component checks prove visible recovery.
Neither establishes factual correctness or durable storage. Keeping these claims separate gives each test a concrete
signal and avoids an expensive browser-first suite.

Provider schema constraints express requested output, while application parsing enforces a tolerant consumer contract.
Tests should protect the accepted consumer behavior using independently specified examples, not blindly demand provider
schema compliance or mirror implementation calculations.

## Historical Context (from prior changes)

- [context/changes/ai-flashcard-review/plan.md:23](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/changes/ai-flashcard-review/plan.md#L23) specifies source bounds, same-language cards, sparse success,
  and review. Its earlier scope excluded an application runner; the current testing change supersedes that restriction.
- [context/changes/ai-flashcard-review/reviews/manual-verification.md:8](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/changes/ai-flashcard-review/reviews/manual-verification.md#L8) records historical manual coverage,
  not reproducible semantic evidence or newly executed checks.
- [context/foundation/roadmap.md:37](https://github.com/MaciekLichon/10x-cards/blob/61a4f5e1b217bbbf519765d485fb59de0bd8bc46/context/foundation/roadmap.md#L37) marks generation done, consistent with live code.
  Review-session status remains in progress while its change is `impl_reviewed`; this unrelated bookkeeping drift
  does not block Phase 1.
- `context/archive/` contains only its README; generation history is still under `context/changes/`.
  No archived files were modified.

## Related Research

- [Spaced repetition research](../spaced-repetition-session/research.md) — adjacent later-phase work, not the source
  of generation expectations.
- [Quality contract](../../foundation/test-plan.md) — risk scope, exclusions, and eventual cookbook requirements.

## Open Questions

These are bounded planning decisions, not blockers to research completion:

1. Finalize the minimal runner/DOM dependency versions and test locations after checking installation compatibility.
2. Assign human ownership of source samples and labels, choose batch-level review policy, and record whether advisory
   AI adds enough signal to justify inclusion.
3. Include neutral sparse copy in the implementation plan; avoid assertions that certify semantic richness from count.
4. Choose representative decoding/validation cases that cover the response matrix without multiplying redundant tests.

## Planning Handoff

Proceed directly with:

```text
/10x-plan testing-ai-generation-validity
```

Use this research and the change brief. Plan minimal runner setup, real-boundary generation checks, focused recovery
integration, independent human fidelity samples/review, and the sparse-wording correction. End implementation with
verified cookbook updates to §6.1 and §6.2, including actual locations, reference tests/samples, naming and exact commands.
Keep test-plan strategy and all Phase 2/3 exclusions intact. Research completion does not imply implemented protection.
