---
date: 2026-09-12T00:21:34+02:00
researcher: Codex
git_commit: 1f678ec87262d4f22181e23cc5280a3baa017377
branch: main
repository: 10x-cards
topic: "Testing collection persistence and ownership"
tags: [research, codebase, flashcards, persistence, ownership, rls, api-integration]
status: complete
last_updated: 2026-09-12
last_updated_by: Codex
---

# Research: Testing collection persistence and ownership

**Date**: 2026-09-12T00:21:34+02:00  
**Researcher**: Codex  
**Git Commit**: 1f678ec87262d4f22181e23cc5280a3baa017377  
**Branch**: main  
**Repository**: 10x-cards

## Research Question

Research the live implementation, existing evidence, and missing automated coverage needed for Phase 2,
`testing-collection-persistence-and-ownership`, covering test-plan risks #3, #4, and #6.

## Summary

Phase 2 has three related but distinct contracts:

1. The AI review workspace must persist exactly the accepted, valid, edited cards as one batch. Rejected cards must not
   reach the persistence request, and failed or ambiguous saves must not produce partial or duplicate rows.
2. Collection reads and writes must remain owner-only through the complete request-cookie, authenticated-locals,
   request-scoped Supabase, and database-RLS chain. Denied writes must leave the owner's rows unchanged and must not
   reveal whether another owner's card exists.
3. Edit and delete operations must target one stable card identity, reject stale versions, avoid replaying ambiguous
   mutations, and preserve visible draft/card state after failure.

The database foundation is stronger than the current application-test inventory. pgTAP covers schema, policy presence,
content constraints, timestamp behavior, and stale conditional mutations. The ordinary-client RLS verifier covers owner,
other-user, and anonymous behavior. Neither crosses Astro middleware/endpoints, and the current Vitest suites cover only AI
generation. The most valuable Phase 2 addition is therefore a layered suite: retain database contract tests, strengthen the
real-client ownership verifier with independent before/after state assertions, and add direct-handler API integration tests
for collection, selected batch save, and conditional mutation contracts.

The rollout's declared `Database + API integration` layers cannot by themselves prove the phrases "failed saves remain
visible" and "failures stay visible." The cheapest additional signal is focused React integration using the existing
jsdom/Testing Library setup. If component coverage is excluded, those visibility claims must remain explicitly manual.

Baseline on 2026-09-12: `npm run test` passed 37 tests in 2 files. No collection, batch-save, card-mutation, session-cookie,
or application-level ownership suite exists.

## Detailed Findings

### 1. Risk and product contract

- The Phase 2 risks are exact persistence of the accepted set (#3), anonymous/cross-account isolation (#4), and targeted
  edits/deletes (#6). The quality contract requires durable-state assertions and warns against response-only assertions,
  mocked authorization, and UI-only mutation checks
  ([test-plan.md:29](../../foundation/test-plan.md#L29), [test-plan.md:42](../../foundation/test-plan.md#L42)).
- US-01 requires only accepted proposals to enter the user's collection
  ([prd.md:47](../../foundation/prd.md#L47)). FR-009 and FR-010 require editing and permanent deletion, while access
  control requires authenticated users to manage only their own cards
  ([prd.md:81](../../foundation/prd.md#L81), [prd.md:114](../../foundation/prd.md#L114)).
- The phase table explicitly selects database and API integration and leaves cookbook sections 6.3 and 6.4 unresolved
  ([test-plan.md:53](../../foundation/test-plan.md#L53), [test-plan.md:134](../../foundation/test-plan.md#L134)).

### 2. Accepted-card and manual persistence

- The React workspace derives the save set by filtering for accepted and individually valid proposals, then sends only
  `{id, question, answer}` for those cards. Edits are retained in that payload; rejected cards are absent
  ([FlashcardWorkspace.tsx:55](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardWorkspace.tsx#L55),
  [FlashcardWorkspace.tsx:98](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardWorkspace.tsx#L98),
  [FlashcardWorkspace.tsx:110](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardWorkspace.tsx#L110)).
- The save endpoint revalidates the submitted batch, reconstructs rows without `user_id`, and makes one multi-row insert
  call. Reconciliation succeeds only when the complete owner-visible ID/content set matches
  ([save.ts:15](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/save.ts#L15),
  [save.ts:43](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/save.ts#L43),
  [save.ts:71](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/save.ts#L71)).
- One PostgREST insert request is intended to be all-or-nothing, but no current automated application or local-stack test
  proves that a mixed valid/conflicting batch leaves zero partial rows. That is a primary missing durable-state assertion.
- On an ambiguous AI save response, the UI performs a read-only reconciliation request and does not replay the insert.
  A definitive failure preserves the proposal set and enables a whole-batch retry
  ([FlashcardWorkspace.tsx:116](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardWorkspace.tsx#L116),
  [FlashcardWorkspace.tsx:151](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardWorkspace.tsx#L151)).
- Accepted-but-invalid proposals are silently omitted when another valid accepted card remains. Tests should make that
  current behavior explicit; planning must decide whether omission is the intended contract or whether the entire reviewed
  set should be rejected as invalid.
- Manual creation keeps a client UUID stable until save and authoritative refresh both succeed
  ([ManualFlashcardForm.tsx:17](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/ManualFlashcardForm.tsx#L17)).
  The endpoint reconciles duplicate or transport-ambiguous inserts using owner-visible ID/content
  ([collection.ts:42](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/collection.ts#L42),
  [collection.ts:113](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/collection.ts#L113)).
- A committed manual save followed by a failed list refresh is intentionally not rolled back. The UI reports the save as
  successful but keeps the form state available because the full success path did not complete
  ([FlashcardCollection.tsx:72](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L72),
  [FlashcardCollection.tsx:132](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L132)).

### 3. Ownership and authorization chain

- Middleware centrally protects `/dashboard` and derives `locals.user` with server-verified `auth.getUser()`
  ([middleware.ts:4](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/middleware.ts#L4)).
  API routes are not redirected by that prefix rule, so each endpoint performs its own `locals.user` check.
- All collection endpoints use an ordinary, cookie-aware, request-scoped Supabase client
  ([supabase.ts:6](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/lib/supabase.ts#L6)).
  Writes also enforce same-origin requests
  ([auth.ts:29](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/lib/auth.ts#L29)).
- Collection queries do not add `user_id` filters, and inserts do not accept or construct `user_id`; the database is the
  ownership authority. Public DTOs omit ownership fields
  ([collection.ts:32](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/collection.ts#L32),
  [collection.ts:78](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/collection.ts#L78)).
- The table defaults `user_id` to `auth.uid()` and enables owner-only SELECT/INSERT/UPDATE/DELETE policies. INSERT and
  UPDATE include `WITH CHECK`, preventing ownership spoofing or transfer
  ([20260815000000_create_flashcards.sql:1](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/migrations/20260815000000_create_flashcards.sql#L1),
  [20260815000000_create_flashcards.sql:28](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/migrations/20260815000000_create_flashcards.sql#L28)).
- Later database grants restrict ordinary authenticated updates to `front` and `back`, protecting identity and scheduler
  fields even from direct clients
  ([20260901000000_add_spaced_repetition.sql:35](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/migrations/20260901000000_add_spaced_repetition.sql#L35)).
- A manual-create payload may contain extra fields such as `user_id`, but parsing returns only `id/front/back`, so the
  endpoint discards the extra ownership input. Historical review accepted this as low-risk contract drift rather than an
  ownership bypass
  ([flashcards.ts:120](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/lib/flashcards.ts#L120),
  [impl-review.md:47](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/personal-flashcard-collection/reviews/impl-review.md#L47)).
- Direct endpoint tests must not construct impossible identity skew such as `locals.user = A` with an authenticated cookie
  for user B. Runtime middleware normally derives both from the same request, while RLS follows the cookie identity.
- A possible session-refresh seam needs explicit integration evidence: middleware and the endpoint each create a Supabase
  client, while the cookie adapter reads the original request `Cookie` header. A refreshed middleware cookie may not be
  visible to the second client in the same request. This is an inference from the current client construction, not a
  demonstrated defect.

### 4. Target identity, optimistic concurrency, and failure recovery

- Inline edit sends the complete content representation plus stable `id` and `updatedAt`; it is not a partial-field PATCH
  ([FlashcardCollectionCard.tsx:52](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollectionCard.tsx#L52),
  [flashcards.ts:93](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/lib/flashcards.ts#L93)).
- PATCH and DELETE validate origin, authentication, canonical and matching path/body IDs, exact body shape, and content
  type before a database operation
  ([[id].ts:43](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/%5Bid%5D.ts#L43)).
- Both mutations predicate the write on `id` and `updated_at`. A zero-row result is followed by an owner-visible read:
  visible means stale conflict (`409`); invisible means the same generic not-found response (`404`) for missing and
  cross-owner IDs
  ([[id].ts:56](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/%5Bid%5D.ts#L56),
  [[id].ts:97](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/%5Bid%5D.ts#L97),
  [[id].ts:135](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/pages/api/flashcards/%5Bid%5D.ts#L135)).
- The classification read is not atomic with the mutation; concurrent changes can affect whether the response is labeled
  conflict or not-found. The stale write itself remains atomically rejected.
- Ambiguous mutation responses trigger a bounded authoritative rebuild of the previously loaded collection window without
  replaying the write. An update is confirmed only by matching ID/content plus a changed version; deletion is confirmed
  only by target absence
  ([FlashcardCollection.tsx:173](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L173),
  [FlashcardCollection.tsx:198](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L198),
  [FlashcardCollection.tsx:241](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L241),
  [FlashcardCollection.tsx:293](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/src/components/flashcards/FlashcardCollection.tsx#L293)).
- Definitive update failure leaves the editor open and keeps its draft. Definitive delete failure leaves the card visible.
  Success modifies the client list by matching the returned/deleted ID, which is the correct target-identity seam for a
  focused component test.

### 5. Existing executable evidence and precise gaps

- pgTAP currently declares 45 assertions. It verifies schema, policies, constraints, index/trigger behavior, stale
  conditional writes, owner-target deletion, and cascade cleanup
  ([flashcards.test.sql:3](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/tests/database/flashcards.test.sql#L3),
  [flashcards.test.sql:73](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/tests/database/flashcards.test.sql#L73),
  [flashcards.test.sql:205](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/supabase/tests/database/flashcards.test.sql#L205)).
  These statements run as privileged SQL and do not behaviorally prove runtime RLS.
- The ordinary-client verifier refuses non-local Supabase, then uses owner, other-user, and anonymous clients. It covers
  owner CRUD, cross-user select/update/delete denial, spoofed insert denial, anonymous select/insert denial, stale writes,
  and selected owner deletion
  ([verify-flashcard-rls.mjs:14](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/scripts/verify-flashcard-rls.mjs#L14),
  [verify-flashcard-rls.mjs:98](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/scripts/verify-flashcard-rls.mjs#L98)).
- The RLS verifier does not immediately compare an independent owner snapshot after each denied write. It also omits
  anonymous update/delete and behavioral proof that an owner cannot transfer `user_id`.
- Current application tests exercise only generation endpoint/provider behavior and workspace generation/recovery. The
  Vitest configuration supports Node API suites and per-file jsdom component suites
  ([vitest.config.ts:5](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/vitest.config.ts#L5),
  [generate.test.ts:46](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/tests/integration/flashcards/generate.test.ts#L46),
  [FlashcardWorkspace.test.tsx:1](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/tests/integration/flashcards/FlashcardWorkspace.test.tsx#L1)).
- The test environment shim currently exports only AI failure-mode variables. Importing collection routes requires adding
  the collection failure-mode export or mocking the module boundary
  ([astro-env.ts:1](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/tests/support/astro-env.ts#L1)).
- The DOM setup has no native-dialog shim, so component tests that open the delete dialog need a local
  `HTMLDialogElement.showModal/close` shim
  ([setup-dom.ts:1](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/tests/setup-dom.ts#L1)).
- `package.json` exposes application, pgTAP, and RLS commands, but `deploy:check` includes none of the test commands
  ([package.json:8](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/package.json#L8)).
  The quality contract correctly treats these gates as local-only and excludes CI work from this phase.

### 6. Recommended test decomposition

| Signal                                     | Canonical scope                                         | Highest-value scenarios                                                                                                                                         | What it must not claim                               |
| ------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| pgTAP database contract                    | Existing `supabase/tests/database/flashcards.test.sql`  | Exact policy/grant shape, content and ownership invariants, conditional mutation and atomic batch behavior where expressible                                    | Cookie, middleware, endpoint, or visible UI behavior |
| Ordinary-client local Supabase integration | Extend or split `scripts/verify-flashcard-rls.mjs`      | Owner/other/anonymous matrix; snapshot owner rows before/after denied writes; spoof/transfer denial; selected-set durable rows                                  | Astro auth/origin/error envelopes                    |
| Direct-handler Vitest API integration      | New tests for `collection.ts`, `save.ts`, and `[id].ts` | Auth/origin/input envelopes; selected payload; reconciliation; non-disclosing zero-row classification; target and version predicates; no replay after ambiguity | Real RLS if Supabase is mocked                       |
| Focused React integration                  | Existing jsdom/Testing Library conventions              | Failed batch retains reviewed set; failed edit retains exact draft; failed delete retains target card; only matching ID changes on success                      | Database durability or authorization                 |
| Optional real request/local-stack crossing | One narrowly scoped authenticated flow                  | Cookie → middleware identity → request client → RLS, including refresh/near-expiry behavior                                                                     | Broad browser journey, which belongs to Phase 3      |

Minimum scenario matrix for planning:

1. Save one mixed reviewed set with edited accepted cards, rejected cards, and an accepted-invalid card; assert the request
   and independent durable row set exactly match the approved contract.
2. Cause a conflicting/invalid batch and prove zero partial inserts. Cause a lost response and prove reconciliation makes no
   second write and creates no duplicate.
3. Snapshot an owner's card plus a decoy card. Attempt other-user and anonymous reads/writes; assert non-disclosing results
   and exact owner state afterward.
4. PATCH one card and prove only its content/version changes while ID, owner, creation time, scheduler state, and decoy rows
   remain unchanged. Repeat with stale `updatedAt` and prove no row changes.
5. DELETE one card and prove only that ID disappears. Repeat with stale and cross-owner requests and prove all owner rows
   remain unchanged.
6. At the component layer, prove definitive save/update/delete failures retain the selected set, exact edit draft, and
   visible undeleted card respectively; prove ambiguous responses trigger read-only reconciliation rather than mutation
   replay.

## Code References

- `src/components/flashcards/FlashcardWorkspace.tsx:55-156` - accepted-set derivation, save, reconciliation, and failure state.
- `src/pages/api/flashcards/save.ts:15-83` - batch validation, one-call insert, and exact reconciliation.
- `src/components/flashcards/FlashcardCollection.tsx:72-337` - collection refresh, manual save, conditional mutation, and UI reconciliation.
- `src/pages/api/flashcards/collection.ts:42-153` - owner-scoped listing and retry-safe manual creation.
- `src/pages/api/flashcards/[id].ts:43-170` - validation, target/version predicates, and non-disclosing result classification.
- `src/lib/supabase.ts:6-24` - request-cookie Supabase client boundary.
- `supabase/migrations/20260815000000_create_flashcards.sql:1-53` - ownership defaults and RLS policies.
- `supabase/migrations/20260901000000_add_spaced_repetition.sql:35-49` - content-version trigger and restricted update grants.
- `supabase/tests/database/flashcards.test.sql:3-265` - existing database contract coverage.
- `scripts/verify-flashcard-rls.mjs:14-232` - existing ordinary-client RLS behavior check.
- `vitest.config.ts:5-20` - current application test runner boundary.

## Architecture Insights

- Ownership is intentionally database-authoritative. Application handlers authenticate and shape requests, but they do not
  implement parallel ownership filters. Tests should preserve this separation instead of embedding mocked ownership logic.
- Stable client-generated UUIDs plus read-only reconciliation form the idempotency strategy for both single and batch
  saves. Conditional `updated_at` predicates provide optimistic concurrency for edit/delete. These are different contracts
  and deserve different fixtures.
- The client treats authoritative server/database state as the source of truth after ambiguous writes. It rebuilds state
  and classifies outcomes rather than replaying destructive operations.
- No single test layer can cover the phase. Database tests prove invariants, ordinary clients prove RLS behavior, handler
  tests prove application contracts, and component tests prove retained/visible failure state.
- API handlers create request-scoped clients rather than accepting dependencies. Direct-handler tests can use module mocks
  for query-shape/error mapping, but a separate real-client layer remains mandatory for ownership claims.
- Database field limits (10,000 per side) are broader than application limits (200/500). Direct authenticated Supabase
  clients can persist content the application API rejects; this is intentional layered validation unless the product
  chooses to make application limits database invariants.

## Historical Context (from prior changes)

- `context/changes/user-owned-flashcard-persistence/plan.md` established RLS as the ownership authority and split schema
  pgTAP evidence from ordinary authenticated-client behavior
  ([plan.md:15](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/user-owned-flashcard-persistence/plan.md#L15),
  [plan.md:105](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/user-owned-flashcard-persistence/plan.md#L105)).
- `context/changes/ai-flashcard-review/plan.md` chose one all-or-nothing accepted-set insert, owner-derived rows, and
  read-only reconciliation after ambiguity
  ([plan.md:264](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/ai-flashcard-review/plan.md#L264)).
- `context/changes/personal-flashcard-collection/plan.md` chose stable client UUIDs, owner-scoped collection reads, and an
  authoritative refresh after manual save
  ([plan.md:55](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/personal-flashcard-collection/plan.md#L55)).
- `context/changes/maintain-flashcard-collection/plan.md` chose conditional mutations, generic missing/cross-owner
  responses, draft preservation, and read-only recovery for ambiguous writes
  ([plan.md:112](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/maintain-flashcard-collection/plan.md#L112),
  [plan.md:197](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/maintain-flashcard-collection/plan.md#L197)).
- Historical endpoint and UI verification is manual. The S-04 matrix records 18 passing scenarios, including target
  identity, cross-owner denial, failures, and lost responses
  ([manual-verification.md:12](https://github.com/MaciekLichon/10x-cards/blob/1f678ec87262d4f22181e23cc5280a3baa017377/context/changes/maintain-flashcard-collection/reviews/manual-verification.md#L12)).
- `context/archive/` contains no archived change artifacts, so relevant completed-slice history remains under
  `context/changes/`.

## Related Research

- [testing-ai-generation-validity/research.md](../testing-ai-generation-validity/research.md) - establishes the current
  Vitest conventions and the rule to keep real application code while replacing only the external boundary.
- [spaced-repetition-session/research.md](../spaced-repetition-session/research.md) - adjacent evidence for the broader
  database-authoritative ownership and atomicity patterns; it does not define Phase 2 expectations.

## Open Questions

1. Should an accepted-but-invalid proposal be silently excluded, as the current UI does, or should it block the complete
   reviewed-set save? The durable expected row set depends on this product decision.
2. Is focused React integration in Phase 2 accepted so the guide can honestly claim failure visibility, or should UI-state
   evidence remain manual until a later phase?
3. Should the phase include one real cookie/middleware/endpoint/local-Supabase crossing, especially for refreshed sessions,
   or explicitly limit automated ownership proof to ordinary Supabase clients plus direct-handler contract tests?
4. Should manual-create payloads reject unknown keys such as `user_id`, or should tests preserve the current discard-extra
   contract?
5. Should test commands remain local-only under the lesson boundary, or is CI enforcement intentionally being rescoped?
