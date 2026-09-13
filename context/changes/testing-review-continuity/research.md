---
date: 2026-09-13T16:41:58+02:00
researcher: Codex
git_commit: b81cf35ca0e1970bb945a63932ac05b029c23db6
branch: main
repository: 10x-cards
topic: "Whether Phase 3 review-continuity testing needs research before planning"
tags: [research, codebase, spaced-repetition, integration-testing]
status: complete
last_updated: 2026-09-13
last_updated_by: Codex
---

# Research: Review-continuity integration coverage

**Date**: 2026-09-13T16:41:58+02:00
**Researcher**: Codex
**Git Commit**: b81cf35ca0e1970bb945a63932ac05b029c23db6
**Branch**: main
**Repository**: 10x-cards

## Research Question

Is a dedicated research pass worthwhile for rollout Phase 3, "Review continuity," or is the existing test-plan detail
sufficient to proceed directly to planning?

## Summary

A focused research pass is worthwhile; another broad architecture or scheduler investigation is not. The existing S-05
research already settles the product policy, scheduler configuration, session boundary, and persistence model. However,
planning directly from the test plan would have missed the precise boundary between existing evidence and the remaining
integration risk.

Existing pgTAP and local verification already prove much of the database contract: due-card ordering and limits, session
resumption and expiry, sequential replay, stale-write rollback, atomic persistence, ownership, and cascades. They do not
prove the real rating endpoint's composition of scheduler output with the persistence RPC, a second review transition from
persisted state, or fresh-session behavior immediately around a card's next due time. The local verifier passes handcrafted
post-state into the RPC, and its HTTP/UI resilience checks inspect source strings rather than execute the runtime path.

The earlier implementation review also records an unresolved same-request concurrency race. Two simultaneous identical
ratings can miss the replay record and return a stale/concurrent error instead of the winner's canonical response. This is
not merely a missing test: a faithful concurrent integration test should expose a known production-contract defect.

Proceed to planning now that this gap inventory exists. Keep Phase 3 deterministic and integration-only; browser,
authentication-cookie, and full UI journey coverage belongs to Phase 4.

## Detailed Findings

### 1. The live rating path crosses boundaries not covered together today

The rating endpoint validates origin, authentication, request shape, session membership, schedule version, and due time
before calling the real scheduler and then the transactional database RPC. A successful response is built only after the
stored session is read back ([rate.ts:35-48](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/pages/api/review/rate.ts#L35-L48),
[rate.ts:78-160](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/pages/api/review/rate.ts#L78-L160),
[rate.ts:249-270](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/pages/api/review/rate.ts#L249-L270)).

The scheduler adapter maps persisted database fields into `ts-fsrs`, runs the pinned deterministic policy, and maps the
result back into the database contract ([fsrs.ts:10-19](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/lib/fsrs.ts#L10-L19),
[fsrs.ts:50-85](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/lib/fsrs.ts#L50-L85)).
No existing Vitest integration suite exercises this adapter with literal persisted rows through a second transition, nor
does one prove the endpoint's scheduler-to-RPC composition.

### 2. Existing database evidence is strong but uses handcrafted scheduler output

The pgTAP suite proves owner-only due membership, deterministic `due, id` ordering, active-session resumption, and exact
24-hour expiry ([spaced_repetition.test.sql:120-158](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/supabase/tests/database/spaced_repetition.test.sql#L120-L158)).
It also proves a single atomic review, sequential canonical replay, request-ID conflict, and stale-version rollback
([spaced_repetition.test.sql:168-226](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/supabase/tests/database/spaced_repetition.test.sql#L168-L226)).

Those tests intentionally provide literal `post_state` JSON to the database function. This is a good independent database
oracle, but it cannot prove that production mapping or scheduler output is persisted correctly. It also does not explicitly
exercise exclusion immediately before `nextDue` and admission at the inclusive `nextDue` cutoff.

The local Supabase verifier similarly passes a handcrafted post-state directly to the RPC, then proves sequential replay
and exact durable state ([verify-spaced-repetition.mjs:195-276](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/scripts/verify-spaced-repetition.mjs#L195-L276)).
Its failure-mode assertions only scan endpoint and UI source text
([verify-spaced-repetition.mjs:333-345](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/scripts/verify-spaced-repetition.mjs#L333-L345)).

### 3. Review continuity depends on explicit time semantics

Session acquisition passes a server-owned cutoff into the database and then reads the same session at that time
([review-session.ts:10-20](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/lib/review-session.ts#L10-L20)).
When a stored waiting card reaches `next_due`, the public session view promotes it to ready
([review-session.ts:52-75](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/lib/review-session.ts#L52-L75),
[review-session.ts:97-100](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/lib/review-session.ts#L97-L100)).

The accepted S-05 decisions define the independent oracle: cards are selected when `due <= cutoff`, the initial membership
is frozen, waits up to 60 seconds remain in-session, longer waits defer, and a card can re-enter only at its new due time
([prior research:181-200](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/context/changes/spaced-repetition-session/research.md#L181-L200)).
Phase 3 fixtures should therefore use literal timestamps around `nextDue - epsilon`, `nextDue`, the 60-second threshold,
and the 24-hour expiry boundary. Expected values must not be calculated with production scheduler helpers.

### 4. The UI has continuity behavior, but browser coverage is a separate rollout phase

The React session advances only from a confirmed canonical response, restores authoritative state on `409`, and retains
the identical request payload after ambiguous server or network failures
([SpacedRepetitionSession.tsx:91-143](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/components/review/SpacedRepetitionSession.tsx#L91-L143)).
It also reloads authoritatively when a waiting card becomes due and when the page becomes visible or returns online
([SpacedRepetitionSession.tsx:54-89](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/src/components/review/SpacedRepetitionSession.tsx#L54-L89)).

Direct React integration tests may cheaply protect confirmed-only advancement, identical-payload retry, and conflict
reconciliation. They must not expand into login, cookies, middleware, or a full browser journey; the test plan assigns
those crossings to Phase 4.

### 5. A known concurrency defect changes the plan

The S-05 implementation review found that the RPC checks for an existing request before request-scoped serialization.
Concurrent identical calls can both miss the log, after which the loser may receive a stale-version or concurrent-request
error instead of the canonical replay result. The finding and its runtime/concurrency coverage warning were explicitly
left `SKIPPED` ([impl-review.md:23-59](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/context/changes/spaced-repetition-session/reviews/impl-review.md#L23-L59)).

Planning must not silently encode that defect as the expected behavior. Add a real concurrent regression test using one
stable request intent and assert one mutation/log plus the same canonical result for both callers. Because this test is
expected to expose the known defect, the plan must explicitly decide whether Phase 3 includes the minimal production fix
or records the failing behavior for a separate fix change. The recommended scope is to include the regression test and
minimal request-scoped serialization fix together so the new required quality gate can pass.

## Recommended Planning Scope

1. Add focused Vitest integration coverage for persisted-row → FSRS → persisted-state mapping, all four ratings, and at
   least one second transition. Use literal input and expected output fixtures independent of production calculations.
2. Add direct-handler integration tests for the real rating orchestration: validation/conflict mapping, real scheduler
   output passed to the RPC, and a successful response based on authoritative reread state.
3. Extend the real-database verifier or pgTAP coverage with literal due-time boundaries: excluded immediately before
   `nextDue`, admitted at equality, durable schedule/version/log state after reacquisition, and exact 60-second/24-hour
   boundary behavior where the owning layer makes those guarantees.
4. Add a concurrent identical-request regression test. Include the minimal serialization fix in this change unless the
   user explicitly chooses a separate defect change.
5. Add React integration cases only for confirmed-only advancement, identical-payload retry after ambiguity, and `409`
   reconciliation. Do not add browser/auth-cookie coverage here.
6. Reuse existing pgTAP and verifier checks for ownership, cap/order, session resumption, sequential replay, stale writes,
   atomicity, expiry persistence, and cascades instead of duplicating them.

## Code References

- `src/pages/api/review/rate.ts:35-160` — live validation, scheduling, disposition, and persistence orchestration.
- `src/pages/api/review/rate.ts:249-270` — canonical response rereads authoritative session state.
- `src/lib/fsrs.ts:50-85` — persisted database row ↔ scheduler state adapter.
- `src/lib/review-session.ts:10-20` — server-cutoff session acquisition.
- `src/lib/review-session.ts:52-100` — durable session projection and waiting-to-ready promotion.
- `src/components/review/SpacedRepetitionSession.tsx:54-143` — waiting refresh, confirmed progress, retry, and reconciliation.
- `supabase/tests/database/spaced_repetition.test.sql:120-226` — current deterministic database/session/replay coverage.
- `scripts/verify-spaced-repetition.mjs:195-276` — current ordinary-client durable-state verifier.
- `scripts/verify-spaced-repetition.mjs:333-345` — source-shape checks that do not execute HTTP/UI behavior.
- `context/changes/spaced-repetition-session/reviews/impl-review.md:23-59` — unresolved concurrency and automation findings.

## Architecture Insights

Review continuity is split across three testable contracts: deterministic scheduling, atomic durable application, and
authoritative client reconciliation. No single test layer proves all three cheaply. The existing suite is strongest at the
database layer; Phase 3 should connect the scheduler and application orchestration to that database evidence without
promoting to E2E.

Server time is authoritative. Tests should inject or freeze boundary timestamps at the owning layer and compare against
literal contract values. Client timers are only triggers for authoritative reloads, not sources of due-state truth.

## Historical Context

The S-05 research already resolved the algorithm, configuration, cutoff, ordering, maximum session size, short-wait,
editing, deletion, and dependency decisions. Reopening those topics would duplicate settled work
([research.md:181-204](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/context/changes/spaced-repetition-session/research.md#L181-L204)).

The S-05 implementation review concluded `NEEDS ATTENTION` with two warnings and no critical findings. Both warnings were
skipped, so they remain current planning inputs rather than closed historical observations
([impl-review.md:7-19](https://github.com/MaciekLichon/10x-cards/blob/b81cf35ca0e1970bb945a63932ac05b029c23db6/context/changes/spaced-repetition-session/reviews/impl-review.md#L7-L19)).

## Related Research

- `context/changes/spaced-repetition-session/research.md` — accepted review-session and scheduler policy.
- `context/changes/spaced-repetition-session/reviews/impl-review.md` — remaining implementation and verification gaps.
- `context/foundation/test-plan.md` §2 risk #5 and §6.5 — rollout intent and cookbook placeholder.

## Open Questions

1. Should the known concurrent identical-request defect be fixed inside this testing rollout change, as recommended, or
   should Phase 3 only land the failing regression test and open a separate production-fix change?
2. Does direct-handler plus React integration coverage provide enough signal for ambiguous-response behavior, or should a
   local running-app HTTP verifier be included despite its higher setup cost? Browser/auth-cookie behavior remains Phase 4
   either way.
