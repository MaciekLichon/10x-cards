# Maintain Flashcard Collection Implementation Plan

## Overview

Implement roadmap slice S-04 so an authenticated user can edit or permanently delete an existing flashcard from the
collection. The change extends the existing owner-scoped collection flow with version-aware mutations, inline editing,
explicit deletion confirmation, and resilient recovery from ambiguous responses.

## Current State Analysis

The application already provides a protected collection page, bounded cursor pagination, manual creation, public
flashcard DTOs, and owner isolation through Supabase RLS. Collection cards are read-only, and the collection API supports
only `GET` and `POST`. The database already has update/delete policies and an `updated_at` trigger, so S-04 does not need a
schema migration.

The collection container coordinates first-page loading, pagination, creation, notices, and errors. Previous S-03 review
found a real stale-pagination race and resolved it by serializing collection operations. S-04 must preserve that invariant
while avoiding a page-wide lock for independent card actions.

## Desired End State

A signed-in user can edit one card inline, save valid front/back content, cancel safely, or permanently delete a card after
an accessible confirmation. Only one card mutation may run at a time; while it runs, mutation controls on other cards are
disabled and only the active card is marked busy. Writes carry the card's current `updatedAt`; stale writes are rejected
without losing the draft, and identity, creation order, and future study progress remain intact after an edit.

Confirmed edits update the loaded DTO in place and confirmed deletes remove it. When a mutation result is ambiguous, the
client rebuilds the authoritative loaded collection window before deciding whether the operation landed. Cross-owner and
missing IDs remain indistinguishable to callers.

### Key Discoveries:

- The collection endpoint already applies authentication, same-origin checks, cookie-aware Supabase access, safe error
  envelopes, and an explicit public projection (`src/pages/api/flashcards/collection.ts:23`,
  `src/pages/api/flashcards/collection.ts:71`, `src/pages/api/flashcards/collection.ts:106`).
- `CollectionFlashcard` already exposes `updatedAt`, enabling an optimistic-concurrency precondition without a schema
  change (`src/lib/flashcards.ts:23`).
- The database trigger advances `updated_at`, and owner-only RLS policies already cover update and delete
  (`supabase/migrations/20260815000000_create_flashcards.sql:12`,
  `supabase/migrations/20260815000000_create_flashcards.sql:42`).
- The collection container owns list and cursor state, while each current card is a display-only component and is the
  natural inline-management boundary (`src/components/flashcards/FlashcardCollection.tsx:31`,
  `src/components/flashcards/FlashcardCollectionCard.tsx:3`).
- The shared UI/API content contract trims values, rejects empty content, and limits fronts to 200 and backs to 500
  characters (`src/lib/flashcards.ts:3`, `src/lib/flashcards.ts:59`).
- Existing ordinary-client verification already proves that owners can update/delete and other users cannot
  (`scripts/verify-flashcard-rls.mjs:123`, `scripts/verify-flashcard-rls.mjs:153`).

## What We're NOT Doing

- Soft delete, trash, undo, bulk edit, or bulk delete.
- Multiple simultaneous edit forms or autosave.
- Resetting or otherwise defining spaced-repetition scheduling state; S-04 preserves card identity for S-05.
- Search, filtering, sorting controls, or changing cursor/page-size behavior.
- Changing database columns, RLS policies, indexes, or the 10,000-character database guardrails.
- Adding a JavaScript test runner, browser automation framework, realtime subscriptions, or offline support.
- Exposing `user_id`, Supabase error details, or whether a hidden cross-owner ID exists.

## Implementation Approach

Add a dynamic owner-scoped resource route for `PATCH` and `DELETE`, leaving collection `GET`/`POST` behavior intact.
Both mutations require a UUID and canonical `updatedAt` precondition. `PATCH` additionally validates trimmed front/back
content with the existing 200/500 limits. A conditional mutation matches both `id` and `updated_at`; zero affected rows
trigger an owner-scoped lookup that returns either a generic not-found result or a version conflict without weakening RLS.

Keep mutation coordination in `FlashcardCollection`, with a single active editor and a serialized single-card mutation
state rather than extending the global creation busy flag. While one card mutation is pending, disable mutation controls
on other cards without marking them busy. The card renders either its display state or an inline edit form and invokes
parent callbacks. Deletion uses an accessible confirmation dialog with Cancel as the initial safe action.

For an ambiguous response, capture the final loaded card's stable `(createdAt, id)` boundary and rebuild pages from the
first cursor with ID deduplication until that boundary is reached or passed, or the collection ends. The target card may
be inspected earlier to classify the mutation, but classification must not terminate rebuilding before the previous
boundary. Compare the refreshed DTO with the submitted version and content to classify confirmed success, safe retry, or
conflict. The rebuilt result is the current authoritative coverage through the old boundary, not a snapshot-identical
copy of the old pages. Never repeat a mutation merely because its response was lost.

## Critical Implementation Details

### State sequencing

Capture the target ID, original `updatedAt`, draft, and the final loaded card's stable `(createdAt, id)` boundary before
dispatch. A refresh after an ambiguous mutation must finish classification and rebuild authoritative coverage through
that boundary before the card is unlocked; otherwise a retry could overwrite a newer edit, report a completed delete as
a failure, or discard later pages the user had already loaded. Collection refresh and pagination must use ID
deduplication plus an operation generation or equivalent stale-response guard so older requests cannot replace reconciled
state.

### User experience spec

Only one card can be edited at once. Switching away closes an unchanged editor immediately, but a dirty editor requires
confirmation before its draft is discarded. A failed or conflicting edit keeps the draft and focus context. Delete
confirmation identifies the action without copying card contents into global notices; after success, focus moves to the
next available card action or the collection/empty-state heading.

## Phase 1: Versioned Mutation Contracts

### Overview

Define and implement secure update/delete contracts with optimistic concurrency, safe public errors, and reproducible
failure paths.

### Changes Required:

#### 1. Shared mutation inputs and validation

**File**: `src/lib/flashcards.ts`

**Intent**: Add explicit update and delete input contracts while reusing the established UUID, timestamp, trimming, and
content limits.

**Contract**: Update input contains exactly `id`, `front`, `back`, and canonical ISO `updatedAt`; delete input contains
exactly `id` and canonical ISO `updatedAt`. Reject missing, extra, malformed, empty, or over-limit fields. Keep public DTOs
and create parsing backward compatible.

#### 2. Owner-scoped resource mutations

**File**: `src/pages/api/flashcards/[id].ts`

**Intent**: Expose version-aware edits and permanent deletes through the ordinary authenticated Supabase client so RLS
remains the ownership boundary.

**Contract**:

- `PATCH /api/flashcards/:id` requires same origin, `locals.user`, JSON content type, a path UUID matching the body ID,
  valid content, and `updatedAt`.
- Conditionally update only `front` and `back` where `id` and `updated_at` match, return the explicit public DTO, and rely
  on the trigger for the new `updatedAt`; never update identity, owner, or creation time. Select the affected rows and
  inspect array length (or use an equivalent zero-or-one-row result); do not use `.single()` where zero matched rows are
  an expected concurrency outcome.
- `DELETE /api/flashcards/:id` applies the same guards and conditionally deletes by `id` and `updated_at`; a confirmed
  success returns the deleted ID without card content.
- On zero affected rows, perform an owner-scoped `id, updated_at` lookup and classify from the owner-visible state at the
  time of that follow-up query. A visible version returns `409 mutation_conflict`; no visible row returns generic `404
  flashcard_not_found` for missing and cross-owner IDs alike. Because mutation and lookup are separate statements, a
  concurrent deletion may legitimately produce `404` even if a stale version originally caused the zero-row result; this
  does not weaken the atomic stale-write rejection or draft preservation guarantees.
- Return safe `{ error: { code, message } }` envelopes: `400 invalid_json`, `400 invalid_flashcard_id`, `401
unauthenticated`, `403 invalid_origin`, `404 flashcard_not_found`, `409 mutation_conflict`, `415 invalid_json`, `422
invalid_flashcard`, `503 database_unavailable`, `503 update_failed`, `503 delete_failed`, and `503 mutation_ambiguous`.
- Treat thrown errors and transport-style `status === 0` results as ambiguous; do not claim success or automatically issue
  a second mutation.

#### 3. Deterministic development failure modes

**Files**:

- `src/pages/api/flashcards/[id].ts`
- `astro.config.mjs`
- `.env.example`

**Intent**: Make version conflicts, definitive failures, and lost update/delete responses reproducible during manual
verification without affecting production.

**Contract**: Extend the existing development-only collection failure enum with update failure/lost-response and delete
failure/lost-response cases. Production must ignore all injected modes.

#### 4. Collection DTO timestamp canonicalization

**File**: `src/pages/api/flashcards/collection.ts`

**Intent**: Keep collection DTO timestamps compatible with the canonical `updatedAt` mutation precondition.

**Contract**: Canonicalize database UTC offsets to the `Z` form when projecting `updatedAt`, without changing timestamp
precision or collection behavior.

### Success Criteria:

#### Automated Verification:

- Astro synchronizes the dynamic API route and environment contract: `npx astro sync`
- Type-aware lint accepts mutation parsers and handlers: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`
- Local database reset and lint preserve the existing schema: `npm run db:reset && npm run db:lint`
- Database catalog tests and generated-type drift checks remain green: `npm run db:test && npm run db:types:check`
- Ordinary-client RLS verification proves owner update/delete and cross-owner denial: `npm run db:verify-rls`

#### Manual Verification:

- Update/delete reject anonymous, cross-origin, malformed, stale, missing, and cross-owner requests with the specified
  non-leaking contract
- Successful update changes only front/back/updatedAt, while successful delete removes only the owner's selected card
- Injected definitive and ambiguous outcomes are reproducible without repeating a mutation

**Implementation Note**: After automated checks pass, pause for human confirmation of the API and failure-path scenarios.

---

## Phase 2: Inline Collection Maintenance

### Overview

Add accessible inline editing and confirmed deletion while preserving collection pagination and unrelated interactions.

### Changes Required:

#### 1. Collection mutation coordination and reconciliation

**File**: `src/components/flashcards/FlashcardCollection.tsx`

**Intent**: Coordinate the active editor, per-card mutation, public error mapping, authoritative updates, and ambiguous
outcome recovery without freezing unrelated cards.

**Contract**:

- Track at most one editing card and one active mutation; switching from a dirty draft requires discard confirmation.
  Reject duplicate mutation dispatches and disable Edit/Delete/Save mutation controls on other cards until the active
  mutation and any required reconciliation finish.
- Send the original `updatedAt` with edit/delete requests. A confirmed edit replaces the matching DTO in place; a
  confirmed delete removes it without discarding already loaded pages.
- Preserve edit drafts after validation, conflict, definitive failure, and ambiguous outcomes until classification.
- On `mutation_ambiguous`, rebuild the loaded window from page one with ID deduplication. Classify the operation when the
  target's stable ordering position is reached, but continue until the previously captured final loaded `(createdAt, id)`
  boundary is reached or passed, or the collection ends. Treat the result as current authoritative coverage through that
  boundary rather than snapshot-identical membership.
- Serialize refresh/pagination replacement through an operation generation or equivalent guard. Disable pagination only
  when it could race with reconciliation; creation and non-mutating interactions otherwise remain usable.
- Map public error codes to safe action-specific messages and expose polite success plus assertive failure announcements.

#### 2. Card action and inline edit UI

**File**: `src/components/flashcards/FlashcardCollectionCard.tsx`

**Intent**: Turn a read-only card into a keyboard-accessible management surface with explicit Edit, Save, Cancel, and
Delete actions.

**Contract**: Display mode preserves the current front/back/date presentation and adds labeled text actions. Edit mode
uses labeled textareas, 200/500 counters, trimmed validation, `aria-invalid`, described errors, and textual Saving state.
Cancel restores original values. Only the active card is `aria-busy` and disabled during its mutation.

#### 3. Single-editor list wiring

**File**: `src/components/flashcards/FlashcardCollectionList.tsx`

**Intent**: Pass edit/delete state and callbacks through the existing stable-ID list without moving collection ownership
into individual cards.

**Contract**: Keep `flashcard.id` as the React key, identify the active editor/mutation by ID, disable mutation controls on
non-active cards while a mutation is pending, and preserve the current empty state and responsive grid. Provide stable
heading/focus targets for successful deletion.

#### 4. Accessible permanent-delete confirmation

**File**: `src/components/flashcards/FlashcardDeleteDialog.tsx`

**Intent**: Require an explicit, accessible confirmation before permanent deletion, addressing the accidental-loss risk
called out by FR-010.

**Contract**: Render a native `<dialog>` opened with `showModal()`, with a title, concise irreversible-action warning,
Cancel, and `Delete flashcard`. On each open, explicitly focus Cancel as the safe initial action. Handle the dialog's
native `cancel` event so Escape follows the same controlled cancellation path; rely on modal dialog behavior to keep the
background non-interactive while open. After cancellation, restore focus to the invoking control. After successful
deletion unmounts that control, move focus to the next available card action or the collection/empty-state heading. Guard
`showModal()` and `close()` calls against React lifecycle/unmount timing. Do not include full flashcard content in
announcements.

### Success Criteria:

#### Automated Verification:

- Astro and React contracts synchronize: `npx astro sync`
- Type-aware ESLint and accessibility rules pass: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`

#### Manual Verification:

- A card can be edited inline with correct 0/1/200/201 front and 0/1/500/501 back boundaries
- Only one editor is open; switching preserves a dirty draft until discard is explicitly confirmed
- Stale edits retain their draft and explain the conflict without overwriting the newer card
- Delete dialog supports keyboard focus, Escape, safe default focus, cancellation, and permanent confirmation
- Only one card mutation runs at a time; other cards' mutation controls are blocked while non-mutating interactions and
  permitted collection actions remain usable
- Edit/delete success, failure, ambiguity, empty-state transition, focus recovery, and live announcements behave correctly
- Maintenance still works for cards loaded through Load More without losing or duplicating other loaded cards

**Implementation Note**: After automated checks pass, pause for human confirmation of browser UX and accessibility.

---

## Phase 3: Resilience and End-to-End Evidence

### Overview

Exercise ownership, concurrency, failure recovery, pagination interaction, and regressions, then record non-sensitive
evidence for implementation review.

### Changes Required:

#### 1. Database and ownership regression coverage

**Files**:

- `supabase/tests/database/flashcards.test.sql`
- `scripts/verify-flashcard-rls.mjs`

**Intent**: Strengthen executable evidence for versioned owner mutations without altering the durable schema.

**Contract**: Preserve catalog assertions and add symmetric behavioral checks that owner updates advance `updated_at`,
stale conditional updates/deletes affect no rows, cross-owner mutations affect no rows, and owner deletion removes the
target. Use only resettable local Supabase data.

#### 2. Manual verification record

**File**: `context/changes/maintain-flashcard-collection/reviews/manual-verification.md`

**Intent**: Preserve date, environment, and pass/fail evidence for S-04 without credentials, card content, raw payloads,
or sensitive screenshots.

**Contract**: Cover validation limits, inline editing, dirty-discard protection, delete dialog accessibility, owner
isolation, stale versions from a second session, definitive and lost responses, reconciliation across loaded pages, last
card deletion, keyboard/focus behavior, and S-02/S-03 regression flows.

#### 3. Final regression pass

**Files**: Project-wide verification only; production files change only if a check exposes a defect.

**Intent**: Confirm application, database, security, and documentation remain coherent before implementation review.

**Contract**: Run all established gates and inspect the final diff for secrets, `user_id` payloads, service-role access,
unrelated S-05 behavior, accidental schema changes, or sensitive verification evidence.

### Success Criteria:

#### Automated Verification:

- Complete database and RLS gate passes: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls`
- Astro synchronization succeeds: `npx astro sync`
- Type-aware lint succeeds: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`
- Final diff contains no secrets, ownership leaks, service-role use, S-05 coupling, or unintended schema changes

#### Manual Verification:

- Two authenticated sessions demonstrate safe edit conflicts and owner isolation without existence disclosure
- Lost edit/delete responses reconcile through an authoritative collection refresh without repeating the mutation
- Editing preserves card identity and deleting the final visible card produces the correct empty state
- Keyboard, focus, dialog, validation, status, and error behavior work in a current desktop browser
- Existing manual creation, pagination, AI generation/review/save, authentication, and navigation still work
- The non-sensitive scenario matrix records pass/fail evidence for every manual criterion

**Implementation Note**: After all automated checks pass, pause for the human to complete the manual matrix before
requesting `/10x-impl-review maintain-flashcard-collection`.

---

## Testing Strategy

### Database and Contract Tests:

- Keep pgTAP schema/RLS catalog assertions and add version-precondition invariants where SQL-level evidence is useful.
- Extend the ordinary authenticated-client verifier for owner success, cross-owner denial, and stale conditional mutation.
- Exercise every public API status/code manually through deterministic development-only failure modes.

### Integration Scenarios:

- Edit and delete cards from the first and later cursor pages, including the final card in the collection.
- Create a stale version in a second session and verify the first session preserves its draft after `409`.
- Lose update/delete responses and verify collection-window refresh classifies the result without repeating the write.
- Regress manual creation, repeated Load More, AI proposal save, authentication, and cross-user isolation.

### Manual Testing Steps:

1. Open two authenticated sessions for one user plus a separate second user.
2. Verify inline edit validation, save, cancel, dirty switching, keyboard order, and focus return.
3. Change the same card in both same-user sessions and verify stale edit/delete conflicts.
4. Confirm and cancel deletion using pointer, keyboard, Escape, and dialog focus traversal.
5. Trigger definitive and lost-response modes for update and delete; verify authoritative recovery.
6. Load multiple collection pages, mutate an older card, and verify no gaps, duplicates, or discarded pages.
7. Verify a second user cannot observe or mutate the first user's card IDs.
8. Run the existing S-02 and S-03 happy paths and record non-sensitive results.

## Performance Considerations

Normal confirmed mutations affect one row and one loaded DTO. Ambiguous recovery may issue several bounded cursor reads,
but only up to the collection window already loaded by the user; it must not fetch the entire account collection without a
bound. Existing keyset pagination and the `(user_id, created_at DESC, id DESC)` index remain unchanged.

## Migration Notes

No database migration or generated type change is expected. Rollback removes the dynamic mutation route and management UI
while leaving collection reads, creation, existing rows, and RLS policies intact.

## References

- Product requirements: `context/foundation/prd.md` (FR-009, FR-010)
- Roadmap slice: `context/foundation/roadmap.md` (S-04)
- S-03 baseline: `context/changes/personal-flashcard-collection/plan.md`
- Collection endpoint: `src/pages/api/flashcards/collection.ts:71`
- Collection state container: `src/components/flashcards/FlashcardCollection.tsx:31`
- Card presentation: `src/components/flashcards/FlashcardCollectionCard.tsx:3`
- Shared contracts: `src/lib/flashcards.ts:17`
- Durable ownership policies: `supabase/migrations/20260815000000_create_flashcards.sql:28`
- Executable RLS verification: `scripts/verify-flashcard-rls.mjs:98`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Versioned Mutation Contracts

#### Automated

- [x] 1.1 Astro synchronizes the dynamic API route and environment contract — 3f43130
- [x] 1.2 Type-aware lint accepts mutation parsers and handlers — 3f43130
- [x] 1.3 Cloudflare-targeted production build succeeds — 3f43130
- [x] 1.4 Local database reset and lint preserve the existing schema — 3f43130
- [x] 1.5 Database catalog tests and generated-type drift checks remain green — 3f43130
- [x] 1.6 Ordinary-client RLS verification proves owner update/delete and cross-owner denial — 3f43130

#### Manual

- [x] 1.7 Mutation requests enforce the specified non-leaking error contract — 3f43130
- [x] 1.8 Successful update and delete preserve all required data invariants — 3f43130
- [x] 1.9 Definitive and ambiguous mutation outcomes are reproducible without repeated writes — 3f43130

### Phase 2: Inline Collection Maintenance

#### Automated

- [x] 2.1 Astro and React contracts synchronize — dad0ad4
- [x] 2.2 Type-aware ESLint and accessibility rules pass — dad0ad4
- [x] 2.3 Cloudflare-targeted production build succeeds — dad0ad4

#### Manual

- [x] 2.4 Inline editing enforces all front and back validation boundaries — dad0ad4
- [x] 2.5 Single-editor switching protects dirty drafts — dad0ad4
- [x] 2.6 Stale edits preserve drafts and do not overwrite newer content — dad0ad4
- [x] 2.7 Delete confirmation satisfies keyboard, focus, cancellation, and permanent-action behavior — dad0ad4
- [x] 2.8 Only the active card is blocked during a mutation — dad0ad4
- [x] 2.9 Mutation outcomes, empty state, focus recovery, and live announcements behave correctly — dad0ad4
- [x] 2.10 Later-page maintenance preserves loaded collection integrity — dad0ad4

### Phase 3: Resilience and End-to-End Evidence

#### Automated

- [x] 3.1 Complete database and RLS gate passes — 9a19900
- [x] 3.2 Astro synchronization succeeds — 9a19900
- [x] 3.3 Type-aware lint succeeds — 9a19900
- [x] 3.4 Cloudflare-targeted production build succeeds — 9a19900
- [x] 3.5 Final diff contains no secrets, ownership leaks, service-role use, S-05 coupling, or schema drift — 9a19900

#### Manual

- [x] 3.6 Two sessions demonstrate safe conflicts and owner isolation — 9a19900
- [x] 3.7 Lost mutation responses reconcile without repeating writes — 9a19900
- [x] 3.8 Edit identity preservation and final-card deletion behave correctly — 9a19900
- [x] 3.9 Desktop keyboard, focus, dialog, validation, status, and error behavior pass — 9a19900
- [x] 3.10 Existing authentication, S-02, and S-03 flows remain functional — 9a19900
- [x] 3.11 Non-sensitive verification evidence is complete — 9a19900
