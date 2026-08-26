# Personal Flashcard Collection Implementation Plan

## Overview

Implement roadmap slice S-03 so an authenticated user can manually create a flashcard and browse their complete,
owner-scoped collection. The feature will add a dedicated collection page, bounded cursor pagination, and retry-safe
single-card persistence while preserving the completed AI generation workflow.

## Current State Analysis

The application already has authentication, a protected `/dashboard`, a typed request-scoped Supabase client, and an
RLS-protected `flashcards` table. The AI workflow can insert reviewed batches, but no route lists persisted cards and no
manual creation contract or collection UI exists. The current owner index supports isolation but not the selected stable
newest-first access path.

The task is intentionally limited to FR-007 and FR-008. Persisted-card editing and deletion belong to S-04, while search,
filtering, and study behavior are not required to make every card reachable through collection browsing.

## Desired End State

A signed-in user can navigate from the AI workspace to `/dashboard/collection`, expand a manual-card form, create a card,
and see an authoritative refreshed first page of their collection. Cards display front, back, and creation date in stable
newest-first order; a Load More action makes the entire collection reachable without unbounded reads.

Both collection reads and manual inserts use the ordinary cookie-aware Supabase client and remain protected by RLS. The
API never returns or accepts `user_id`. Manual save retries use a client-generated UUID and owner-scoped reconciliation so
an interrupted response cannot silently create a duplicate.

### Key Discoveries:

- `/dashboard` is centrally protected with prefix matching, so `/dashboard/collection` inherits authentication without a
  second page-level authorization implementation (`src/middleware.ts:4`, `src/middleware.ts:18`).
- The durable table already provides UUID identity, owner defaults, content, timestamps, and owner-only SELECT/INSERT RLS
  policies (`supabase/migrations/20260815000000_create_flashcards.sql:1`,
  `supabase/migrations/20260815000000_create_flashcards.sql:28`).
- The existing UI and server validation use concise 200-character questions and 500-character answers; manual cards will
  use the same front/back limits while duplicates remain allowed (`src/lib/flashcards.ts:3`).
- The AI save endpoint establishes the same-origin, authentication, JSON validation, request-scoped Supabase, client UUID,
  and ambiguous-result reconciliation patterns to preserve (`src/pages/api/flashcards/save.ts:15`,
  `src/pages/api/flashcards/save.ts:43`).
- No application test runner exists. Database verification, Astro synchronization, lint, production build, and a recorded
  manual scenario matrix are therefore the required evidence.

## What We're NOT Doing

- Editing or deleting persisted flashcards; those capabilities belong to S-04.
- Search, filtering, sorting controls, page-number navigation, or collection grouping.
- Blocking or warning about duplicate fronts or duplicate front/back pairs.
- A study mode, answer reveal interaction, scheduling fields, or spaced-repetition behavior.
- Changing the existing broad database content constraints or adding provenance for AI versus manual cards.
- Sharing, imports, mobile-specific UX, analytics, caching, realtime updates, or a new application test framework.
- Automatically reflecting an AI save in an already-open collection page; opening or refreshing the page reads current
  server state.

## Implementation Approach

Add one collection API route with `GET` and `POST` handlers. `GET` returns at most 20 public flashcard DTOs, ordered by
`created_at DESC, id DESC`, plus an opaque next cursor when another page exists. `POST` accepts one client UUID with
trimmed `front` and `back`, inserts without `user_id`, and supports reconciliation of ambiguous outcomes by selecting the
submitted UUID through the same RLS boundary.

Add a composite owner/order index for the keyset query. Build a dedicated Astro page containing a React collection island
that loads the first page on mount, appends subsequent pages, exposes an expandable creation form, and reloads page one
after a confirmed or reconciled save. Keep the existing dashboard generation island intact and add reciprocal navigation.

## Critical Implementation Details

### State sequencing

Keep a manual card's client UUID stable across the initial request and reconciliation. Generate a new UUID only after the
previous card is confirmed saved; otherwise a lost success response followed by retry could insert a second row. After a
successful save, close and clear the form only once the refreshed first collection page succeeds; if refresh fails, retain
the success notice and expose collection Retry rather than resubmitting the card.

### User experience spec

The collection-read error is inline and does not disable or replace the manual-creation form. Loading more must preserve
already rendered cards on failure and offer another Load More attempt. Creation, reconciliation, loading, success, and
errors must use accessible live announcements consistent with the existing workspace.

## Phase 1: Collection Data Contract and API

### Overview

Create the stable database access path and authenticated API contracts for bounded reads and retry-safe manual creation.

### Changes Required:

#### 1. Collection index migration and database verification

**Files**:

- `supabase/migrations/20260823000000_add_flashcard_collection_index.sql`
- `supabase/tests/database/flashcards.test.sql`

**Intent**: Add an index matching owner-scoped newest-first cursor reads and extend database tests to verify the index
without changing the six-column flashcard schema or its RLS policies.

**Contract**: Create an index on `(user_id, created_at DESC, id DESC)`. Keep the existing constraints, trigger, owner
policies, and generated TypeScript row shape unchanged.

#### 2. Shared manual-card and cursor contracts

**File**: `src/lib/flashcards.ts`

**Intent**: Add reusable public collection DTOs and strict parsing for manual creation and opaque page cursors while
preserving the AI proposal parsers.

**Contract**:

- Manual input is `{ id: UUID, front: string, back: string }`; trim both fields, require non-empty content, cap front at
  200 and back at 500 characters, and allow duplicates.
- A collection item exposes only `id`, `front`, `back`, `createdAt`, and `updatedAt`; it never exposes `user_id`.
- Cursor payload contains a validated ISO timestamp and UUID tie-breaker. Encode it as an opaque URL-safe string and reject
  malformed, non-date, or non-UUID cursors before constructing a Supabase filter.
- Page size is fixed at 20. Query 21 rows to determine `hasMore`, return only 20, and derive `nextCursor` from the last
  returned row.

#### 3. Authenticated collection endpoint

**Files**:

- `src/pages/api/flashcards/collection.ts`
- `astro.config.mjs`
- `.env.example`

**Intent**: Provide owner-scoped collection browsing and retry-safe manual creation through the established direct
Supabase route pattern.

**Contract**:

- `GET /api/flashcards/collection?cursor=<opaque>` requires `locals.user`, validates the optional cursor, explicitly
  selects `id, front, back, created_at, updated_at`, orders by `created_at DESC, id DESC`, and returns
  `{ flashcards, nextCursor }`.
- For a cursor `(createdAt, id)`, select rows where `created_at < createdAt` or where `created_at = createdAt` and
  `id < id`. Values must be validated before interpolation into the PostgREST filter.
- `POST /api/flashcards/collection` follows the existing same-origin, authentication, JSON content-type, parsing, and safe
  structured-error conventions. Insert `{ id, front, back }` only and return `{ flashcard }` after selecting the public
  fields; never accept or send `user_id`.
- `{ id, front, back, reconcile: true }` performs an owner-scoped lookup by UUID. An exact match returns the existing public
  card, no row is a confirmed retryable failure, and mismatched content is a conflict that must not be retried.
- A thrown insert or transport-level Supabase result such as `status === 0` triggers reconciliation. Confirmed database
  rejection returns a retryable save failure only when retrying the same stable UUID is safe without claiming the row
  exists.
- A duplicate-primary-key rejection also triggers owner-scoped reconciliation. An exact visible match returns the existing
  card, a visible content mismatch returns a non-retryable conflict, and no RLS-visible row returns a non-retryable ID
  conflict. Never generate a replacement UUID for a duplicate-key response because the original insert may have committed.
- Return errors as `{ error: { code, message } }` without Supabase details, using this public status/code contract:
  - `400 invalid_cursor` for a malformed collection cursor.
  - `400 invalid_json` for malformed JSON, `415 invalid_json` for a non-JSON request, and `422 invalid_flashcard` for a
    structurally invalid or out-of-bounds manual card.
  - `401 unauthenticated` when no signed-in user is available and `403 invalid_origin` for a rejected write origin.
  - `503 database_unavailable` when storage is not configured and `503 collection_unavailable` when a collection query
    fails.
  - `503 save_failed` when absence is confirmed and retrying the same stable UUID is safe, `503 save_ambiguous` when
    reconciliation itself cannot establish an outcome, `409 save_conflict` for an owner-visible UUID/content mismatch,
    and `409 id_conflict` when a duplicate UUID has no owner-visible row. Both conflict codes are non-retryable.
- The collection island maps these exact codes to safe user-facing messages and uses a generic safe fallback for unknown
  codes; response messages remain non-sensitive and are not treated as the client contract.
- Add an optional `DEV_COLLECTION_FAILURE_MODE` server environment enum, documented in `.env.example`, with
  `read_failure`, `save_failure`, `save_lost_response`, and `reconcile_failure` modes. Honor it only when
  `import.meta.env.DEV`; production behavior must be unaffected. The modes respectively return a collection-read failure,
  reject before insert, return `save_ambiguous` after a committed insert, and fail the reconciliation lookup.

### Success Criteria:

#### Automated Verification:

- Local migrations reset cleanly: `npm run db:reset`
- Database lint reports no errors: `npm run db:lint`
- Database tests verify the collection index and preserve the flashcard schema/RLS contract: `npm run db:test`
- Generated database types remain current after the index-only migration: `npm run db:types:check`
- Existing executable owner-isolation verification passes: `npm run db:verify-rls`
- Astro route and environment types synchronize: `npx astro sync`
- Type-aware lint accepts the collection contracts and endpoint: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`

#### Manual Verification:

- Anonymous collection reads and writes are rejected, and cross-user rows never appear through the endpoint
- Empty, whitespace-only, 200/201-character front and 500/501-character back boundaries behave as specified
- Equal timestamps paginate deterministically by UUID without gaps or duplicates
- Confirmed save failure, lost response, reconciliation, retry, and content-conflict paths do not create duplicate rows

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation
that the endpoint and failure-path checks succeeded before proceeding.

---

## Phase 2: Collection Page and Creation Workflow

### Overview

Deliver the dedicated collection experience, navigation, accessible manual form, complete browsing, and resilient UI
states on top of the Phase 1 contracts.

### Changes Required:

#### 1. Collection page and workspace navigation

**Files**:

- `src/pages/dashboard.astro`
- `src/pages/dashboard/collection.astro`

**Intent**: Add clear navigation between the existing AI workspace and the new collection page while retaining the
current signed-in identity, sign-out action, visual shell, and centralized route protection.

**Contract**: `/dashboard/collection` uses the existing Layout and cosmic page shell, identifies Collection as the active
destination, links back to `/dashboard`, and mounts the collection island with `client:load`. The `/dashboard` page gains a
Collection link but otherwise preserves S-02 behavior. Do not add duplicate page-level auth or another protected-route
entry because the existing `/dashboard` prefix already covers the child route.

#### 2. Collection state container

**File**: `src/components/flashcards/FlashcardCollection.tsx`

**Intent**: Own initial loading, collection data, append pagination, inline retry, form disclosure, save/reconciliation,
and authoritative first-page refresh behavior.

**Contract**:

- Fetch page one on mount; distinguish loading, loaded-empty, loaded-list, and initial-load error states.
- Keep the create control available during collection read errors and offer an inline Retry action.
- Append Load More results without replacing existing cards. Disable duplicate requests, preserve existing cards after a
  pagination error, and hide Load More when `nextCursor` is absent.
- After manual save or reconciliation succeeds, re-fetch page one and replace collection/cursor state. Do not optimistically
  prepend the returned card.
- Preserve the saved outcome if the follow-up read fails; a Retry re-reads collection data and must never resubmit POST.
- Use safe client error mappings and polite/assertive live regions consistent with the AI workspace.

#### 3. Expandable manual creation form

**File**: `src/components/flashcards/ManualFlashcardForm.tsx`

**Intent**: Let users reveal a focused two-field form, validate a manual card, and submit it once without cluttering the
default browsing view.

**Contract**:

- The Add flashcard control expands/collapses the form and exposes labeled Front and Back textareas with live character
  counts, 200/500 maxima, field-level messages, `aria-invalid`, and described-by relationships.
- Trimmed empty values and over-limit values block submission client-side; the server remains authoritative.
- Create one UUID when beginning a card and retain it across submit/reconcile attempts. Disable the form and disclosure
  control while saving or reconciling to prevent duplicate submission.
- On confirmed failure, preserve content and UUID for safe retry. On successful save plus refreshed collection, clear the
  fields, issue a new UUID for the next card, collapse the form, and move focus to a meaningful success target.

#### 4. Collection list and card presentation

**Files**:

- `src/components/flashcards/FlashcardCollectionList.tsx`
- `src/components/flashcards/FlashcardCollectionCard.tsx`

**Intent**: Render a responsive, accessible collection with complete card content and useful creation context but no S-04
management controls.

**Contract**: Render front, back, and a locale-formatted creation date from the API DTO. Use stable card IDs as React
keys, preserve the established responsive grid and glass-card visual language, and provide a useful empty state that
points to Add flashcard. Do not add edit, delete, answer reveal, or study controls.

### Success Criteria:

#### Automated Verification:

- Astro synchronizes the nested page and React component contracts: `npx astro sync`
- Type-aware ESLint and accessibility rules pass: `npm run lint`
- Cloudflare-targeted production build emits both protected dashboard routes: `npm run build`

#### Manual Verification:

- Signed-in users can navigate between AI workspace and Collection without regressing generation state on either page
- Collection presents correct loading, empty, list, inline read-error Retry, and pagination-error recovery states
- Add flashcard expands an accessible form; invalid boundaries are explained and duplicate submissions are disabled
- Successful and reconciled creation reload the authoritative first page, clear and collapse the form, and show the card
- Cards display front, back, and creation date newest-first; Load More reaches older cards without gaps or duplicates
- Keyboard navigation, focus recovery, visible focus, status announcements, and desktop responsive layout are usable

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation
that the browser behavior and accessibility checks succeeded before proceeding.

---

## Phase 3: End-to-End Verification and Evidence

### Overview

Run the full project and database gates, exercise S-03 across users and failures, and preserve a non-sensitive manual
verification record suitable for implementation review.

### Changes Required:

#### 1. Manual verification record

**File**: `context/changes/personal-flashcard-collection/reviews/manual-verification.md`

**Intent**: Record the environment, date, and pass/fail result for each manual scenario without retaining card content,
credentials, raw payloads, or sensitive screenshots.

**Contract**: Cover protected-route behavior, two-user isolation, validation boundaries, empty/list states, stable cursor
pagination, normal and reconciled saves, reload-after-save, read and write failures, keyboard/accessibility behavior, and
the existing AI generation-to-save regression flow.

#### 2. Final regression pass

**Files**: Project-wide verification only; no production file is expected unless a check exposes a defect.

**Intent**: Confirm the implementation, migration, generated types, security boundary, and completed S-02 workflow remain
coherent before implementation review.

**Contract**: Run the repository's database, Astro, lint, and Cloudflare build gates from a clean local database state.
Inspect the final diff for accidental edit/delete controls, user IDs in API contracts, service-role access, secrets, or
manual verification content.

### Success Criteria:

#### Automated Verification:

- Local database reset, lint, pgTAP, type drift, and executable RLS verification all pass: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls`
- Astro synchronization succeeds: `npx astro sync`
- Type-aware lint succeeds: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`
- Working-tree inspection contains no secrets, retained user card content, `user_id` collection payloads, or S-04 controls

#### Manual Verification:

- Anonymous users are redirected from the collection page and cannot call collection APIs successfully
- Two authenticated users can create and browse only their own cards, including across cursor pages
- Manual creation, refresh-after-save, ambiguous-response reconciliation, and safe retry work without duplicate rows
- The complete collection remains reachable in stable newest-first order through repeated Load More actions
- Collection UI states and accessibility behavior work in a current desktop browser
- Existing login, AI generation, review, and save behavior remains functional
- A non-sensitive scenario matrix records the environment, date, and pass/fail evidence for every manual criterion

**Implementation Note**: After all automated checks pass, pause for the human to complete and confirm the recorded manual
matrix before requesting `/10x-impl-review personal-flashcard-collection`.

---

## Testing Strategy

### Database Tests:

- Extend pgTAP catalog checks for the composite collection index while preserving the exact table, constraint, trigger,
  and RLS expectations.
- Keep the executable RLS verifier as the behavioral regression gate for anonymous and cross-user access.

### API Contract Verification:

- Exercise unauthenticated, invalid cursor, invalid origin, invalid content type, invalid JSON, invalid UUID, empty/whitespace,
  and both field-length boundaries.
- Seed more than one page, including cards with equal timestamps, then verify stable order, cursor continuity, no overlap,
  and termination with a null cursor.
- Simulate confirmed insert failure, transport ambiguity, lost success response, exact reconciliation, and mismatched UUID
  content; verify that only the intended single row exists.
- Use `DEV_COLLECTION_FAILURE_MODE=read_failure` for inline read retry, `save_failure` for confirmed pre-insert failure,
  `save_lost_response` for commit-followed-by-reconciliation, and `reconcile_failure` for an unresolved ambiguous result;
  restart the development server after changing the mode and clear it between scenarios.
- Produce an owner-visible mismatch by reconciling an already-saved UUID with changed content. Produce the RLS-hidden
  duplicate-ID case by seeding the same UUID for the second test user, then inserting it as the first user; expect the
  non-retryable `id_conflict`. Seed equal `created_at` values through local SQL to verify the UUID tie-breaker and cursor
  continuity. Record only content-free outcomes in the manual verification matrix.

### Manual Testing Steps:

1. Reset local Supabase, seed or create two users, and start the Astro development server.
2. Verify anonymous page redirect and API rejection, then sign in as the first user.
3. Open Collection, test empty state and inline Retry, then expand and validate the manual form boundaries.
4. Create a card normally and verify authoritative reload, collapsed/cleared form, success feedback, and displayed date.
5. Exercise ambiguous save and reconciliation while confirming the stable UUID produces exactly one row.
6. Create more than 20 cards, including equal timestamps, and traverse every Load More page without gaps or duplicates.
7. Sign in as the second user and verify neither account can observe or reconcile the other's cards.
8. Confirm keyboard/focus/live-region behavior and responsive desktop layout.
9. Return to the AI workspace and complete generation, review, and save as an S-02 regression check.
10. Record content-free results in `reviews/manual-verification.md` and run all final automated gates.

## Performance Considerations

Use fixed-size keyset pages rather than offset pagination or an unbounded owner query. The composite owner/time/ID index
matches the RLS-filtered newest-first access path, while the UUID tie-breaker guarantees deterministic ordering for equal
timestamps. Creation performs one insert/select path plus one first-page refresh; reconciliation adds a lookup only when
the outcome is ambiguous.

## Migration Notes

The only schema migration adds a non-destructive composite index. It does not change stored rows, constraints, RLS, or
generated database types. Rollback can drop that index, but should occur only alongside code rollback because collection
queries would otherwise lose their intended access path. Existing flashcards remain visible and need no backfill.

## References

- Change identity: `context/changes/personal-flashcard-collection/change.md`
- Roadmap slice S-03: `context/foundation/roadmap.md:105`
- Product requirements FR-007 and FR-008: `context/foundation/prd.md:81`
- Existing dashboard integration point: `src/pages/dashboard.astro:10`
- Central protected-route prefix: `src/middleware.ts:4`
- Shared flashcard limits and parsers: `src/lib/flashcards.ts:1`
- Existing retry-safe persistence pattern: `src/pages/api/flashcards/save.ts:15`
- Durable flashcard schema and RLS: `supabase/migrations/20260815000000_create_flashcards.sql:1`
- Existing database contract verification: `supabase/tests/database/flashcards.test.sql`
- Existing owner-isolation verifier: `scripts/verify-flashcard-rls.mjs`
- S-02 implementation plan and review lessons: `context/changes/ai-flashcard-review/plan.md`
- F-01 persistence plan and review lessons: `context/changes/user-owned-flashcard-persistence/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Collection Data Contract and API

#### Automated

- [x] 1.1 Local migrations reset cleanly: `npm run db:reset` — 95ce4c5
- [x] 1.2 Database lint reports no errors: `npm run db:lint` — 95ce4c5
- [x] 1.3 Database tests verify the collection index and preserve the flashcard schema/RLS contract: `npm run db:test` — 95ce4c5
- [x] 1.4 Generated database types remain current after the index-only migration: `npm run db:types:check` — 95ce4c5
- [x] 1.5 Existing executable owner-isolation verification passes: `npm run db:verify-rls` — 95ce4c5
- [x] 1.6 Astro route and environment types synchronize: `npx astro sync` — 95ce4c5
- [x] 1.7 Type-aware lint accepts the collection contracts and endpoint: `npm run lint` — 95ce4c5
- [x] 1.8 Cloudflare-targeted production build succeeds: `npm run build` — 95ce4c5

#### Manual

- [x] 1.9 Anonymous collection reads and writes are rejected, and cross-user rows never appear through the endpoint — 95ce4c5
- [x] 1.10 Empty, whitespace-only, 200/201-character front and 500/501-character back boundaries behave as specified — 95ce4c5
- [x] 1.11 Equal timestamps paginate deterministically by UUID without gaps or duplicates — 95ce4c5
- [x] 1.12 Confirmed save failure, lost response, reconciliation, retry, and content-conflict paths do not create duplicate rows — 95ce4c5

### Phase 2: Collection Page and Creation Workflow

#### Automated

- [x] 2.1 Astro synchronizes the nested page and React component contracts: `npx astro sync` — 4b82760
- [x] 2.2 Type-aware ESLint and accessibility rules pass: `npm run lint` — 4b82760
- [x] 2.3 Cloudflare-targeted production build emits both protected dashboard routes: `npm run build` — 4b82760

#### Manual

- [x] 2.4 Signed-in users can navigate between AI workspace and Collection without regressing generation state on either page — 4b82760
- [x] 2.5 Collection presents correct loading, empty, list, inline read-error Retry, and pagination-error recovery states — 4b82760
- [x] 2.6 Add flashcard expands an accessible form; invalid boundaries are explained and duplicate submissions are disabled — 4b82760
- [x] 2.7 Successful and reconciled creation reload the authoritative first page, clear and collapse the form, and show the card — 4b82760
- [x] 2.8 Cards display front, back, and creation date newest-first; Load More reaches older cards without gaps or duplicates — 4b82760
- [x] 2.9 Keyboard navigation, focus recovery, visible focus, status announcements, and desktop responsive layout are usable — 4b82760

### Phase 3: End-to-End Verification and Evidence

#### Automated

- [x] 3.1 Local database reset, lint, pgTAP, type drift, and executable RLS verification all pass: `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls`
- [x] 3.2 Astro synchronization succeeds: `npx astro sync`
- [x] 3.3 Type-aware lint succeeds: `npm run lint`
- [x] 3.4 Cloudflare-targeted production build succeeds: `npm run build`
- [x] 3.5 Working-tree inspection contains no secrets, retained user card content, `user_id` collection payloads, or S-04 controls

#### Manual

- [x] 3.6 Anonymous users are redirected from the collection page and cannot call collection APIs successfully
- [x] 3.7 Two authenticated users can create and browse only their own cards, including across cursor pages
- [x] 3.8 Manual creation, refresh-after-save, ambiguous-response reconciliation, and safe retry work without duplicate rows
- [x] 3.9 The complete collection remains reachable in stable newest-first order through repeated Load More actions
- [x] 3.10 Collection UI states and accessibility behavior work in a current desktop browser
- [x] 3.11 Existing login, AI generation, review, and save behavior remains functional
- [x] 3.12 A non-sensitive scenario matrix records the environment, date, and pass/fail evidence for every manual criterion
