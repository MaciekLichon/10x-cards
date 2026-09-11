---
change_id: testing-ai-generation-validity
title: Test AI generation validity and source fidelity
status: impl_reviewed
created: 2026-09-06
updated: 2026-09-11
archived_at: null
---

## Notes

This change delivers Phase 1, **AI generation validity**, of
[the test plan](../../foundation/test-plan.md). The goal is to reject unusable AI output, recover cleanly,
and assess whether generated flashcards preserve the source meaning.

### Risks and intended protection

- **Risk #1 — Invalid AI output breaks generation or appears usable.** Prove that invalid output produces
  a recoverable failure while valid cards remain usable. Challenge the assumption that HTTP success means
  valid cards. Research must ground the response format, provider boundary, and error/UI recovery;
  contract and integration tests are the proposed cheapest layer. Avoid happy-path-only coverage.
- **Risk #2 — Valid-looking cards misrepresent source meaning.** Assess whether questions are answerable
  and preserve source meaning using independent source samples and a human-authored rubric. Structural
  validity does not prove correctness. Selective AI assistance is conditional on additional signal and
  human calibration; avoid a model judging itself without calibration.

### Scope and constraints

- Choose protection by cost × signal. Add only the runner setup needed for product tests and reuse existing checks.
- Derive expected outcomes from requirements and independent fixtures, never from production logic.
- Mock the external response boundary while retaining real application validation and recovery.
- Ground malformed, empty, structurally invalid, and provider-error cases in research before planning tests.
- Preserve test-plan §7 exclusions: configuration-specific testing, vendor internals, provider availability,
  infrastructure/CI investment, broad visual snapshots, and autonomous browser review. Rate limiting is outside scope.
- Finish implementation by updating cookbook §6.1 and §6.2 with verified locations, reference tests or review
  samples, naming, and exact run/review commands. Live-provider checks remain selective.

### Research handoff

Read the test plan and this note, trace the actual failure paths, locate existing tests, and verify the
cheapest useful protection for each risk. Treat semantic validity as a hypothesis to validate, not an
assumed defect. The test plan's `src/lib/` churn (10 commits/30d, recorded 2026-09-06 within `src/`, excluding
generated types) is likelihood evidence, not a failure-location anchor.

Write findings to `context/changes/testing-ai-generation-validity/research.md`, including code citations,
response-guidance corrections, and any speculative risks. Then suggest the direct `/10x-plan` invocation
unless a blocker or test-plan correction requires returning to `/10x-test-plan`.

### Confirmed planning decisions

- Interview Q1: Replace the sparse-result explanation with neutral count-based wording in this change.
- Interview Q2: An unsupported or contradictory answer fails the card and batch fidelity assessment. Retain evidence
  and open a separate follow-up; this testing rollout may complete once the assessment and triage process works.
  Do not silently expand this change into prompt or model tuning.
- Interview Q3: Codex drafts three synthetic source samples, expected facts, and rubric. The user reviews, corrects,
  and approves the references before generated cards are assessed; drafts alone are not human-validated evidence.
- Interview Q4: Deliver the reference materials and assessment procedure in this rollout. The first review of live
  generated output is deferred and is not a completion prerequisite; do not claim measured source fidelity at closure.
  Superseded on 2026-09-08 during plan review: the final plan expanded acceptance to require one real generation run
  and a documented human assessment. See `plan.md` and `reviews/plan-review.md`.
- Interview Q5: Assess factual fidelity separately from usefulness. Unsupported, contradictory, or source-unanswerable
  answers fail fidelity; record omissions, edits, and usefulness descriptively without a fixed percentage threshold.
- The user approved three implementation phases: API contract tests; UI recovery tests and neutral sparse copy;
  reference materials, assessment procedure, and cookbook updates. See `plan.md` and `plan-brief.md`.
