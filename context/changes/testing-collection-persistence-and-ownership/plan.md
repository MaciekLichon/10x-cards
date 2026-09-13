# Testing Collection Persistence and Ownership Implementation Plan

## Overview

Add layered automated evidence for risks #3, #4, and #6: accepted cards must persist exactly, other users and anonymous
clients must not access or alter owner data, and edit/delete operations must affect only the intended card while keeping
failed work visible. This is a test and quality-contract change; it does not alter production behavior, schema, CI, or
the browser-testing stack.

## Current State Analysis

The repository has strong database-shape coverage and a local ordinary-client RLS verifier, but no application tests for
collection persistence, batch saves, card mutations, or ownership at the Astro request boundary. The React workspace and
collection components already implement stable IDs, conditional `updated_at` writes, read-only reconciliation after
ambiguous responses, and visible failure retention, but those contracts are currently tested only manually or indirectly.

The current workspace deliberately sends only accepted and individually valid proposals. Rejected proposals and accepted
but invalid proposals remain visible but are omitted from the save request. Manual creation uses a stable client UUID and
reconciles ambiguous inserts by reading the owner-visible row. Ownership remains database-authoritative: handlers check
authentication and shape inputs, while RLS determines which rows are visible or mutable.

## Desired End State

The change has executable evidence at three complementary layers: a real local Supabase verifier for RLS and durable
state, direct-handler Vitest suites for request/response and query contracts, and focused React integration tests for
selection, draft/card retention, target identity, and ambiguity recovery. The quality cookbook identifies canonical tests,
commands, and claim boundaries for accepted-card persistence/ownership and collection mutations.

### Key Discoveries:

- `FlashcardWorkspace` derives `{ id, question, answer }` from accepted-valid proposals and the save endpoint performs one multi-row insert (`src/components/flashcards/FlashcardWorkspace.tsx:55-57`, `src/pages/api/flashcards/save.ts:43-73`).
- `FlashcardCollection` preserves drafts/cards on definitive failure and rebuilds the loaded window read-only after ambiguous mutation responses (`src/components/flashcards/FlashcardCollection.tsx:173-225`, `:241-337`).
- RLS defaults ownership to `auth.uid()` and protects SELECT/INSERT/UPDATE/DELETE; authenticated updates are restricted to content fields (`supabase/migrations/20260815000000_create_flashcards.sql:1-53`, `supabase/migrations/20260901000000_add_spaced_repetition.sql:35-49`).
- Existing pgTAP tests cover schema and policy shape, while `scripts/verify-flashcard-rls.mjs` lacks immediate owner snapshots after denied writes, anonymous update/delete, transfer denial, and real conflicting-batch atomicity.
- Vitest already supports Node handler suites and per-file jsdom React suites; collection handlers need `DEV_COLLECTION_FAILURE_MODE` in the env shim and collection UI tests need dialog/animation-frame shims.

## What We're NOT Doing

- Changing production save, ownership, reconciliation, or UI behavior.
- Requiring accepted-invalid cards to block a batch; tests lock in the current accepted-valid-only contract.
- Adding a real middleware/cookie/browser journey; that belongs to Phase 3 of the project test rollout.
- Adding Playwright, CI gates, hooks, MCP configuration, deployment checks, or infrastructure tests.
- Rejecting unknown manual-create payload keys; preserve the current parser behavior that discards extra fields such as `user_id`.
- Expanding pgTAP to re-prove PostgreSQL statement atomicity when the ordinary-client verifier can exercise the real boundary.

## Implementation Approach

Use the cheapest layer that proves each claim. First strengthen the one local ordinary-client verifier, reusing its two
authenticated users and reset-based isolation. Then add direct-handler suites that mock only `@/lib/supabase`, retaining
real Astro handlers, parsers, origin checks, DTO mapping, and error envelopes. Finally add focused React suites using the
existing Testing Library conventions. Keep fixtures explicit and independent of production calculations: literal UUIDs,
known timestamps, target/decoy cards, and a mixed reviewed proposal set.

## Critical Implementation Details

The local verifier must remain one executable because each run creates two confirmed users, local auth is rate-limited,
and splitting scripts would duplicate setup and increase flakiness. For ambiguous writes, assertions must prove a read-only
reconciliation and no second mutation request. Direct-handler mocks must never be used as evidence of RLS isolation.

## Phase 1: Strengthen Local Persistence and Ownership Evidence

### Overview

Extend the existing ordinary-client verifier to prove exact durable state and owner isolation through the real local
PostgREST/RLS boundary, while retaining the existing pgTAP contract suite unchanged unless a small privilege assertion is
needed for clarity.

### Changes Required:

#### 1. Ordinary-client verifier

**File**: `scripts/verify-flashcard-rls.mjs`

**Intent**: Add reusable explicit-column snapshot helpers and deterministic target/decoy fixtures so every denied write
is followed immediately by an independent owner-state comparison.

**Contract**: Preserve the local-host guard, two-user signup flow, and reset-based cleanup. Snapshot all ownership,
content, timestamp, and scheduling columns by sorted ID; prove anonymous SELECT/INSERT/UPDATE/DELETE denial, other-user
read/update/delete denial, spoofed insert denial, and inability to transfer ownership. Prove that an allowed owner edit
changes only front/back and the content version, and that deletion removes exactly the requested target while the decoy
remains unchanged.

#### 2. Durable selected-set and atomic conflict scenarios

**File**: `scripts/verify-flashcard-rls.mjs`

**Intent**: Exercise the persistence boundary with stable UUIDs and independent reads rather than relying on response
payloads.

**Contract**: Insert a deterministic approved set and assert the exact ID/content/owner set, excluding a sentinel. Then
submit one valid novel row plus one conflicting primary key in a single insert; assert an error, absence of the novel row,
and byte-for-byte preservation of the pre-existing row and owner snapshot. Keep the claim limited to exact submitted-set
persistence; accepted/rejected selection remains an application-layer concern.

### Success Criteria:

#### Automated Verification:

- Local Supabase reset, migrations, pgTAP, and the strengthened verifier pass: `npm run db:reset && npm run db:test && npm run db:verify-rls`.
- The verifier proves immediate owner-state equality after every denied mutation and exact target/decoy invariants.

#### Manual Verification:

- Review verifier output to confirm each risk scenario has a named PASS line and no assertion relies only on zero returned rows.
- Confirm the run is performed against an isolated local stack and cleanup instructions remain clear.

## Phase 2: Add Direct API Integration Contracts

### Overview

Add deterministic Vitest suites for batch save, collection listing/manual creation, and conditional PATCH/DELETE handlers.
Retain real application code while replacing only the request-scoped Supabase client boundary.

### Changes Required:

#### 1. Test environment and shared database fake

**Files**: `tests/support/astro-env.ts`, `tests/support/` (new focused helper if needed), `vitest.config.ts`

**Intent**: Make collection routes importable and provide narrow, suite-local fluent-query builders for each handler
suite, extracting only repeated record and response behavior into a focused helper if duplication proves material.

**Contract**: Export `DEV_COLLECTION_FAILURE_MODE = undefined`; each suite-local builder supports only the exact query
chains that suite exercises and captures its inserted rows, selected fields, IDs, and `updated_at` predicates. Extract
only repeated record/response behavior; do not create a general cross-suite query framework. Do not mock parsers,
origin checks, handlers, or DTO mapping.

#### 2. Batch save suite

**File**: `tests/integration/flashcards/save.test.ts`

**Intent**: Prove accepted-set payload shaping, all-or-none request behavior, reconciliation classification, and no retry
after an ambiguous result.

**Contract**: Cover authentication, same-origin, content-type, and payload failures before `createClient`; assert one
insert containing only `{ id, front, back }`; assert `reconcile: true` performs only a read; cover exact reconciliation
success, empty/partial/content-mismatched results, transport ambiguity, and no second insert. Keep component-boundary
review-state fixtures in Phase 3 rather than treating the handler as responsible for review state.

#### 3. Collection and mutation suites

**Files**: `tests/integration/flashcards/collection.test.ts`, `tests/integration/flashcards/mutations.test.ts`

**Intent**: Lock request envelopes, public DTOs, stable-ID reconciliation, conditional target/version predicates, and
non-disclosing zero-row classification.

**Contract**: Cover unauthenticated GET/POST, origin and JSON validation, pagination mapping, manual payloads with ignored
extra keys, duplicate/ambiguous manual creation, and canonical timestamp output. For PATCH/DELETE assert matching path
and body IDs, exact `id + updated_at` predicates, successful target response, stale conflict classification, generic
cross-owner/not-found classification, and ambiguous classifier failures. Tests must state that mocked handlers do not
prove RLS.

### Success Criteria:

#### Automated Verification:

- New Node suites pass with the existing runner: `npm run test -- tests/integration/flashcards/save.test.ts tests/integration/flashcards/collection.test.ts tests/integration/flashcards/mutations.test.ts`.
- Handler suites retain real parsing, origin, authentication, reconciliation, and response-envelope behavior while only `@/lib/supabase` is mocked.
- Full application tests still pass: `npm run test`.

#### Manual Verification:

- Review representative fixtures to confirm expected rows are written independently of production helper calculations.
- Confirm ambiguous-path assertions reject any second mutation call.

## Phase 3: Add Focused React Recovery Coverage

### Overview

Automate the user-visible portions of risks #3 and #6 using jsdom and Testing Library, preserving the existing component
patterns and keeping network calls stubbed at `fetch`.

### Changes Required:

#### 1. Workspace persistence behavior

**File**: `tests/integration/flashcards/FlashcardWorkspace.test.tsx`

**Intent**: Extend the existing workspace suite from generation recovery into selected-set persistence and save recovery.

**Contract**: With explicit edited accepted-valid, rejected, and accepted-invalid proposals, assert the POST body contains
only accepted-valid cards. On definitive failure, retain every proposal and edit; on ambiguous failure, assert exactly one
read-only reconciliation request and no insert replay; assert exact success count and cleared source only after confirmed
success.

#### 2. Collection failure visibility and target identity

**File**: `tests/integration/flashcards/FlashcardCollection.test.tsx`

**Intent**: Add focused tests for initial loading, edit failure, delete failure, successful target-only changes, and
ambiguous mutation recovery.

**Contract**: Queue the initial collection GET before mutation responses. Verify failed PATCH keeps the editor open with the
exact draft, failed DELETE leaves the target and decoy visible with target-scoped error, successful PATCH changes only the
matching ID, and ambiguous PATCH/DELETE performs read-only collection rebuilds without replaying the mutation. Scope
delete-dialog queries to the open dialog.

#### 3. DOM/test support

**Files**: `tests/setup-dom.ts`, `tests/support/astro-env.ts`

**Intent**: Supply only the browser APIs required by the existing components.

**Contract**: Install `HTMLDialogElement.showModal/close` shims in `beforeEach` so they are restored for every test;
the shims must maintain `open`, with deterministic `requestAnimationFrame/cancelAnimationFrame` behavior installed the
same way. Keep cleanup and mock restoration after each test.

### Success Criteria:

#### Automated Verification:

- Focused React suites pass: `npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx tests/integration/flashcards/FlashcardCollection.test.tsx`.
- Full Vitest suite passes without network access: `npm run test`.
- Tests prove retained drafts/cards and no mutation replay, not merely rendered success messages.

#### Manual Verification:

- Run a local UI smoke check for save failure, edit failure, delete failure, and retry/reconciliation messaging.
- Confirm the visible error remains associated with the intended card and the decoy card is unaffected.

## Phase 4: Run Gates and Complete the Cookbook Handoff

### Overview

Run the complete local validation set and document canonical Phase 2 test references without changing frozen strategy
sections or adding CI infrastructure.

### Changes Required:

#### 1. Quality-contract cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the two Phase 2 cookbook placeholders with the executable reference tests, commands, fixture rules,
and claim boundaries established by Phases 1–3.

**Contract**: Update only `§6.3 Accepted-card persistence and ownership` and `§6.4 Collection mutations`. Record the
ordinary-client verifier and API/React references, local-stack prerequisites, exact commands, and what each layer must
not claim. Leave §§1–5 and §7 unchanged.

#### 2. Repository validation

**Files**: no production source changes expected.

**Intent**: Verify the new suites coexist with repository type, lint, sync, build, database, and generated-type checks.

**Contract**: Use the existing commands and do not add CI or deploy-script wiring in this lesson.

### Success Criteria:

#### Automated Verification:

- Database and RLS gates pass: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls`.
- Application gates pass: `npx astro sync && npm run test && npm run lint && npx astro check && npm run build`.
- Both cookbook entries identify canonical tests, commands, fixture isolation, and claim boundaries.

#### Manual Verification:

- Review the final diff for test-only scope, no secrets, no archive edits, and no frozen strategy changes.
- Confirm local manual smoke scenarios align with the automated evidence before marking the phase complete.

## Testing Strategy

### Unit Tests:

- Use direct handler suites for validation envelopes, query predicates, DTO mapping, reconciliation outcomes, and no-replay guarantees.
- Keep fixtures explicit and independent of production calculations.

### Integration Tests:

- Use the real local Supabase verifier for RLS, durable state, target/decoy invariants, and conflicting-batch atomicity.
- Use jsdom/Testing Library for visible proposal, draft, card, and ambiguity-recovery behavior.

### Manual Testing Steps:

1. Reset the local Supabase stack and run the complete database/RLS gate sequence.
2. Run the dashboard flow with controlled save/update/delete failure modes and verify retained state and retry messaging.
3. Review the cookbook entries against the actual canonical test paths and commands.

## Performance Considerations

The real-client verifier intentionally uses one run and shared users to avoid repeated auth setup and local rate limits.
React tests should queue only the requests needed by each scenario; no browser or load-testing infrastructure is added.

## Migration Notes

No schema or production migration is planned. Database tests run against the existing local migrations and are isolated by
the verifier's local reset/cleanup workflow.

## References

- Research: `context/changes/testing-collection-persistence-and-ownership/research.md`
- Quality contract: `context/foundation/test-plan.md`
- Existing RLS verifier: `scripts/verify-flashcard-rls.mjs`
- Existing database contract: `supabase/tests/database/flashcards.test.sql`
- Existing handler/component conventions: `tests/integration/flashcards/generate.test.ts`, `tests/integration/flashcards/FlashcardWorkspace.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Strengthen Local Persistence and Ownership Evidence

#### Automated

- [x] 1.1 Local Supabase reset, migrations, pgTAP, and the strengthened verifier pass — 13fb601
- [x] 1.2 The verifier proves immediate owner-state equality after denied writes and exact target/decoy invariants — 13fb601

#### Manual

- [x] 1.3 Verifier output is reviewed for named PASS lines and non-zero-row assertions — 13fb601
- [x] 1.4 The run is confirmed against an isolated local stack with clear cleanup instructions — 13fb601

### Phase 2: Add Direct API Integration Contracts

#### Automated

- [x] 2.1 New batch-save, collection, and mutation handler suites pass — b5a7d07
- [x] 2.2 Handler suites retain real parsing, origin, authentication, reconciliation, and response behavior — b5a7d07
- [x] 2.3 Full application tests pass — b5a7d07

#### Manual

- [x] 2.4 Representative fixtures are reviewed for expected rows independent of production helper calculations — b5a7d07
- [x] 2.5 Ambiguous-path assertions are confirmed to reject any second mutation call — b5a7d07

### Phase 3: Add Focused React Recovery Coverage

#### Automated

- [x] 3.1 Focused workspace and collection React suites pass
- [x] 3.2 Full Vitest suite passes without network access
- [x] 3.3 Tests prove retained drafts/cards and no mutation replay

#### Manual

- [x] 3.4 Local UI smoke scenarios cover save, edit, delete, and retry/reconciliation messaging
- [x] 3.5 Visible errors remain associated with the intended card and the decoy card is unaffected

### Phase 4: Run Gates and Complete the Cookbook Handoff

#### Automated

- [ ] 4.1 Database and RLS gates pass
- [ ] 4.2 Application gates pass
- [ ] 4.3 Cookbook entries identify canonical tests, commands, fixture isolation, and claim boundaries

#### Manual

- [ ] 4.4 Final diff is reviewed for test-only scope, no secrets, no archive edits, and no frozen strategy changes
- [ ] 4.5 Local manual smoke scenarios align with the automated evidence before phase completion
