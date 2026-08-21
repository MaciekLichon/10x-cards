# AI Flashcard Generation and Review Implementation Plan

## Overview

Deliver the first complete AI-assisted flashcard workflow. An authenticated user pastes source text, receives validated
question-and-answer proposals in the source language, edits or rejects them, and atomically saves only the accepted cards
to the existing user-owned Supabase table.

## Current State Analysis

Authentication, the protected `/dashboard`, a cookie-aware typed Supabase client, and the user-owned `flashcards` table
already exist. The dashboard is only a placeholder, there are no application JSON endpoints or flashcard UI components,
and the repository has no AI client or provider configuration. The database stores `front` and `back`, permits 1–10,000
trimmed characters per side, and uses RLS plus `auth.uid()` defaults to enforce ownership.

The infrastructure decision names OpenRouter as the external AI provider and recommends Web-API-compatible adapters for
the Cloudflare Workers runtime. Source text must remain request-scoped and must not appear in application storage or logs.
The repository has no JavaScript test runner; this change deliberately uses the established static/build gates and a
documented manual behavior matrix instead of introducing one.

## Desired End State

An authenticated user can paste 1,000–10,000 characters into the dashboard and request flashcards while seeing a clear
pending state. The server asks OpenRouter for 5–15 plain-text, standalone question-and-answer proposals in the source
language, validates the response, removes duplicates, and may return 1–4 valid cards with a clear sparse-result notice
rather than inventing filler.

The user can edit, accept, or reject every proposal. Questions are limited to 200 characters and answers to 500
characters at both API boundaries and in the UI. Clicking Save selected inserts the entire selected set in one Supabase
statement, mapping `question` to `front` and `answer` to `back`; either all selected cards are saved or none are. Empty
selection is a valid no-save outcome. Source text and unselected proposals are never persisted.

### Key Discoveries:

- `src/pages/dashboard.astro:4` already receives the verified user and is protected by `src/middleware.ts:4`.
- `src/lib/supabase.ts:6` creates the request-scoped typed client used for RLS-protected inserts.
- `supabase/migrations/20260815000000_create_flashcards.sql:3` defaults ownership from `auth.uid()` and
  `supabase/migrations/20260815000000_create_flashcards.sql:34` enforces insert ownership.
- `src/types/database.types.ts:31` exposes durable `front`/`back` names, so question/answer mapping belongs at the API
  persistence boundary rather than in a migration.
- `context/foundation/infrastructure.md:150` requires the future OpenRouter credential to remain a Worker secret and
  `context/foundation/infrastructure.md:168` recommends capped, minimally transformed responses.
- `src/lib/auth.ts:29` provides the same-origin mutation check already used by auth endpoints.
- `src/components/auth/FormField.tsx:39` establishes accessible field/error conventions but supports only inputs, so the
  generation workflow needs purpose-built textarea controls.

## What We're NOT Doing

- Adding manual card creation, collection browsing, editing persisted cards, or deletion; those belong to S-03/S-04.
- Adding spaced-repetition fields, scheduling, ratings, or study sessions.
- Storing source text, rejected proposals, provider payloads, generation history, or AI provenance.
- Importing PDF, DOCX, URLs, or files; input remains pasted plain text.
- Renaming `front`/`back` columns or narrowing their database-wide 10,000-character constraints.
- Adding streaming UI, background jobs, retries, caching, rate limiting, or production analytics in this MVP slice.
- Adding a JavaScript test runner, unit tests, or automated browser tests.
- Deploying, rotating, or retrieving OpenRouter or Cloudflare secrets.

## Implementation Approach

Keep provider integration, domain validation, UI state, and persistence as separate boundaries. A small OpenRouter adapter
uses `fetch`, a timeout signal, and structured JSON instructions without adding an SDK. Shared pure TypeScript contracts
normalize source input and proposals, enforce limits, discard malformed entries, and deduplicate questions. The generation
endpoint authenticates the request, applies same-origin and input validation, calls the adapter, and returns only the
normalized proposal contract.

The protected dashboard hosts a React island that owns the transient source and proposal state. It sends JSON to a
separate save endpoint after review. That endpoint independently revalidates the edited selection and issues one
multi-row insert through the ordinary cookie-aware Supabase client; PostgreSQL statement atomicity and existing RLS give
the all-or-nothing ownership-safe save contract.

## Critical Implementation Details

### User experience spec

Generating disables repeat submission and exposes an `aria-live` progress message for the full request. A successful
response containing fewer than five cards is still a success and explains that the source contained fewer distinct useful
concepts. After an atomic save succeeds, the saved proposals must not remain actionable, preventing accidental duplicate
saves in the same UI session.

### State sequencing

Rejected cards are removed from the pending selection but remain recoverable until the user starts a new generation or
saves, so an accidental rejection can be undone without another paid request. Starting a new generation must explicitly
replace the current unsaved proposal set. The save endpoint performs validation before its single insert and never falls
back to per-row inserts.

### Debug and observability

Server logs may include a request correlation identifier, elapsed time, provider status category, source character count,
and proposal count. They must never include the source text, generated question/answer content, authorization headers,
cookies, provider response bodies, or secret values.

## Phase 1: AI Generation Foundation

### Overview

Establish the server-only provider configuration, domain contracts, OpenRouter adapter, and authenticated generation API.

### Changes Required:

#### 1. Server-only provider configuration

**Files**: `.env.example`, `astro.config.mjs`, `wrangler.jsonc`, `src/lib/config-status.ts`,
`src/pages/dashboard.astro`

**Intent**: Make the OpenRouter credential and model discoverable across local and Worker environments without exposing
secret values to client bundles.

**Contract**: Add optional server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` variables to Astro's environment schema
so missing AI configuration does not prevent the application from building or unrelated routes from rendering. Document
placeholders in `.env.example`; configure `OPENROUTER_API_KEY` as a local/Cloudflare secret and `OPENROUTER_MODEL` as a
server-side Wrangler variable rather than a credential. Extend configuration diagnostics without ever printing values,
but render the missing-AI notice only from the protected dashboard instead of the global layout. Keep model selection
configuration-driven rather than hard-coding a provider model in UI or domain code.
For deterministic manual verification, also declare an optional server-only `DEV_AI_FAILURE_MODE` that is read only when
`import.meta.env.DEV` is true and is ignored in production builds. Permit only the documented values `provider_timeout`,
`provider_rejection`, `malformed_output`, `save_failure`, and `save_lost_response`; do not place this variable in deployed
Wrangler configuration.

#### 2. Flashcard generation contracts and validation

**File**: `src/lib/flashcards.ts`

**Intent**: Give both endpoints one canonical, provider-independent definition of valid source text and editable
proposals.

**Contract**: Export plain TypeScript types and parsing functions for `{ question, answer }` proposals. Trim values;
require source length 1,000–10,000 characters; require 1–15 proposals after normalization; limit questions to 200 and
answers to 500 characters; reject empty or non-string fields; and remove substantially identical proposals using a
deterministic normalized-question key. Distinguish invalid user input from unusable provider output so endpoints can map
them to stable response codes and safe messages.

#### 3. OpenRouter adapter

**File**: `src/lib/openrouter.ts`

**Intent**: Isolate the external provider and keep the rest of the application portable across Workers-compatible
runtimes.

**Contract**: Use Web `fetch` to `POST https://openrouter.ai/api/v1/chat/completions` with the configured key/model, JSON
content headers, an abort timeout slightly above the 10–15 second target, capped output tokens, and a prompt that requests
5–15 standalone, non-overlapping, plain-text question/answer objects in the source language. Require
`response_format.type: "json_schema"` with a named strict schema whose root object contains only a required `proposals`
array of objects containing only required string `question` and `answer` fields. Set `provider.require_parameters: true`
so OpenRouter routes only to providers that honor the schema. Parse non-streaming output from
`choices[0].message.content`, then pass the decoded object through the domain validator. Treat an unsupported configured
model/provider combination as a categorized configuration error; do not silently downgrade to free-form output. Throw
separate categorized errors for timeout, provider rejection, malformed payload, or zero valid proposals. Do not log
source or generated content and do not automatically retry paid requests. In development only, make the three provider
fault modes return their corresponding categorized failures before issuing a paid external request.

#### 4. Authenticated generation endpoint

**File**: `src/pages/api/flashcards/generate.ts`

**Intent**: Expose generation to the protected React workflow without trusting client validation.

**Contract**: Add a JSON-only `POST` route that requires same-origin requests, a verified `Astro.locals.user`, and
`{ sourceText: string }`. Before invoking the adapter, validate that both optional server-only OpenRouter values are
present and non-empty; otherwise return the stable missing-configuration error without importing or invoking provider
code. Return `{ proposals, sparse }` on success, where `sparse` is true for 1–4 valid cards. Use stable HTTP statuses and
machine-readable error codes for invalid JSON/input, unauthenticated access, missing configuration, provider
timeout/failure, and unusable output. Responses and logs must not echo source text.

### Success Criteria:

#### Automated Verification:

- Astro generates current environment and route types successfully: `npx astro sync`
- Type-aware lint accepts provider, validation, and endpoint code: `npm run lint`
- Cloudflare-targeted build succeeds with server-only OpenRouter imports: `npm run build`

#### Manual Verification:

- Valid same-language source text returns 1–15 normalized proposals and never exceeds the 200/500 field limits
- Inputs at 999, 1,000, 10,000, and 10,001 characters demonstrate both accepted boundaries and both rejections
- Missing auth, wrong origin, invalid JSON, unsupported structured-output configuration, timeout, provider failure,
  malformed output, and zero valid proposals return safe distinct errors without exposing source text, generated
  content, or credentials
- A sparse source yielding 1–4 useful cards succeeds with `sparse: true` instead of being padded or rejected

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before proceeding.

---

## Phase 2: Generation and Review Interface

### Overview

Replace the protected dashboard placeholder with the complete transient source, generation, editing, and selection flow.

### Changes Required:

#### 1. Protected dashboard host

**File**: `src/pages/dashboard.astro`

**Intent**: Keep S-02 inside the already protected route while preserving verified-user context and sign-out access.

**Contract**: Render the AI flashcard workspace as a `client:load` React island inside the existing layout and visual
language. Keep the page protected by the centralized `/dashboard` middleware rule; do not duplicate route protection in
the component.

#### 2. Source input and workflow state

**Files**: `src/components/flashcards/FlashcardWorkspace.tsx`,
`src/components/flashcards/SourceTextInput.tsx`

**Intent**: Guide users toward useful source material and make the 10–15 second operation understandable and safe.

**Contract**: Provide an accessible textarea with source-quality guidance, live character count, 1,000/10,000 boundaries,
and client-side messages matching server validation. Manage explicit idle, generating, reviewing, saving, saved, and error
states; prevent duplicate submissions; announce progress and failures; preserve source text after recoverable generation
errors; and require confirmation before replacing unsaved proposals with a new generation.

#### 3. Editable proposal review

**Files**: `src/components/flashcards/ProposalList.tsx`, `src/components/flashcards/ProposalCard.tsx`

**Intent**: Let users efficiently inspect and control every generated card before persistence.

**Contract**: Label fields Question and Answer, enforce live 200/500 character limits, show validation errors, and provide
accept/reject plus undo-reject behavior for each proposal. Assign each proposal a stable client-generated UUID that is
submitted as the persisted flashcard ID and retained unchanged across save retries. Surface the sparse-result explanation
when applicable, display accepted/total counts, permit rejecting all cards,
and disable Save selected when no accepted valid cards remain.

#### 4. Shared status presentation

**Files**: `src/components/flashcards/FlashcardWorkspace.tsx`, `src/components/auth/ServerError.tsx` (reuse where suitable)

**Intent**: Present actionable generation/save feedback using the repository's existing accessibility conventions.

**Contract**: Map machine-readable endpoint codes to concise user messages, use assertive alerts for errors and polite
live regions for progress/success, and keep retry behavior explicit. Provider internals and raw response bodies must never
reach the UI.

### Success Criteria:

#### Automated Verification:

- Astro synchronizes the dashboard island and component contracts: `npx astro sync`
- Type-aware ESLint and accessibility rules pass: `npm run lint`
- Production build emits the dashboard workflow for Cloudflare Workers: `npm run build`

#### Manual Verification:

- A signed-in desktop user can paste valid text, see continuous progress, and review same-language proposals
- Source guidance, character count, focus order, keyboard controls, field errors, and live announcements are usable
- Every proposal can be edited, accepted, rejected, and restored; rejecting all cards remains a valid no-save state
- Starting over warns before discarding unsaved edits, while a recoverable generation failure preserves the source text
- Questions and answers cannot be submitted empty or beyond 200/500 characters after editing

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before proceeding.

---

## Phase 3: Atomic Persistence and End-to-End Verification

### Overview

Persist the selected edited set through the existing ownership boundary and verify the full user-visible workflow.

### Changes Required:

#### 1. Authenticated atomic save endpoint

**File**: `src/pages/api/flashcards/save.ts`

**Intent**: Save exactly the selected valid cards without partial success, ownership spoofing, or source retention.

**Contract**: Add a JSON-only same-origin `POST` route requiring `Astro.locals.user` and the request-scoped Supabase
client. Accept `{ proposals: Array<{ id, question, answer }> }`, require each `id` to be a valid UUID, reject empty or
more-than-15 batches, reapply all 200/500, trim, and duplicate validations, map to `{ id, front, back }`, omit `user_id`
so the database default supplies ownership, and perform one multi-row `.insert()` statement. Return only a saved count or
stable safe error; never retry row by row after failure. When the insert result is ambiguous, query the submitted IDs
through the same authenticated, RLS-scoped client: report success only if every ID exists for the current owner, report a
confirmed failure if none exist, and return a non-retryable conflict if only a subset exists or any stored content differs
from the submitted batch. In development only, `save_failure` must return a categorized database failure before the
insert, while `save_lost_response` must complete the insert and then return an ambiguous server failure so the UI's
owner-scoped reconciliation path can be exercised deterministically.

#### 2. Save lifecycle in the workspace

**Files**: `src/components/flashcards/FlashcardWorkspace.tsx`, `src/components/flashcards/ProposalList.tsx`

**Intent**: Connect reviewed selection to the atomic endpoint with unambiguous success and retry behavior.

**Contract**: Send only accepted, currently edited proposals with their stable client-generated UUIDs; disable mutations
while saving; retain the reviewed set after a confirmed failure for a safe whole-batch retry; and on success clear or lock
the saved set, announce the saved count, and offer a clear action to generate another set. Treat an ambiguous response as
pending reconciliation rather than blindly retrying or optimistically claiming individual cards were saved.

#### 3. Environment and workflow documentation

**File**: `README.md`

**Intent**: Make local AI setup and manual verification reproducible without weakening secret handling.

**Contract**: Document the OpenRouter variable names, ignored `.env`/`.dev.vars` setup, `OPENROUTER_API_KEY` secret setup,
`OPENROUTER_MODEL` server-side variable setup and compatible-model responsibility, source limits, local generation smoke
test, and final validation commands. State that secret values and source/generated content must not be copied into logs,
screenshots, commits, or review artifacts.

### Success Criteria:

#### Automated Verification:

- Existing flashcard ownership verification still passes: `npm run db:verify-rls`
- Astro type synchronization succeeds: `npx astro sync`
- Type-aware lint succeeds: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`
- Working-tree inspection contains no OpenRouter key, source text fixture, or generated user content

#### Manual Verification:

- Saving 1 and 15 accepted edited cards creates exactly that many owner-visible rows with question mapped to `front` and
  answer mapped to `back`
- Rejecting all proposals performs no insert and leaves the application usable
- An invalid card or confirmed database failure saves zero rows; retrying the unchanged valid batch and UUIDs creates one
  copy of each card, while a simulated lost success response reconciles the committed IDs without inserting duplicates
- A second authenticated user cannot access the first user's saved cards, and anonymous generation/save requests fail
- Browser refresh and Worker logs reveal no persisted source text or raw generated content
- The complete login → generate → edit/reject → atomic save flow is usable in a modern desktop browser

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before closing implementation.

---

## Testing Strategy

### Automated Checks:

- Do not add a JavaScript test runner or application test suite in this change.
- Treat `npx astro sync`, type-aware ESLint, and the Cloudflare-targeted build as compile/static integration gates.
- Re-run the existing RLS verification to ensure the save path still relies on the proven ownership boundary.

### Manual Contract Matrix:

- Exercise source lengths 999, 1,000, 10,000, and 10,001 and question/answer lengths 0, 1, max, and max + 1.
- Exercise unauthenticated, cross-origin, invalid JSON, missing configuration, timeout, provider error, malformed response,
  zero-card response, sparse 1–4 response, normal 5–15 response, and duplicate response cases.
- Exercise accept, edit, reject, undo reject, reject all, replace unsaved generation, save failure, atomic retry, success,
  and repeat-generation states using non-sensitive sample text.
- Verify owner-only persistence through the existing two-user RLS script and direct local inspection.

### Manual Testing Steps:

- Start the local server separately with each documented `DEV_AI_FAILURE_MODE` value; use a signed-in dashboard session
  and non-sensitive sample text/batches to exercise the corresponding path.
- Confirm `provider_timeout`, `provider_rejection`, and `malformed_output` produce distinct safe UI errors without making
  a paid OpenRouter request or logging source/generated content.
- Confirm `save_failure` inserts zero rows and preserves the reviewed batch for retry. Restart without the mode and retry
  the unchanged UUID-bearing batch; verify exactly one copy of each card exists.
- Confirm `save_lost_response` commits the batch, surfaces an ambiguous result, reconciles through the owner-scoped UUID
  lookup, and finishes successfully without a second insert or duplicate rows.
- Run `npm run build` and inspect the production configuration/code path to verify `DEV_AI_FAILURE_MODE` is ignored when
  `import.meta.env.DEV` is false and is absent from deployed Wrangler variables.

1. Configure local OpenRouter key/model values in ignored environment files and start the Astro development server.
2. Sign in, verify invalid source boundaries, then generate from valid single-language source text.
3. Inspect sparse and normal results, edit fields at their boundaries, reject/restore cards, and reject all.
4. Save selected cards, inspect owner rows, and verify the exact `question → front` and `answer → back` mapping.
5. Simulate provider timeout/malformed output and Supabase insert failure; confirm safe recovery and no partial rows.
6. Inspect browser network/history and Worker-compatible logs to confirm source and generated content are not retained.
7. Run `npm run db:verify-rls`, `npx astro sync`, `npm run lint`, and `npm run build`.

## Performance Considerations

Cap source input at 10,000 characters, request no more than 15 cards, and cap provider output tokens to bound cost,
latency, and Workers CPU spent parsing. Use one provider request and one database insert per successful workflow. Record
only content-free timing/count metadata so the 10–15 second target can be evaluated without retaining user material.
Streaming is excluded unless later measurements show that the pending-state experience is insufficient.

## Migration Notes

No database migration is required. The stricter 200/500 proposal limits are workflow rules, while the existing broader
1–10,000 database constraints remain available to later manual-card features. Deployment requires adding the OpenRouter
credential/model configuration before code activation; rolling back Worker code does not remove secrets, but no schema
rollback is involved.

## References

- Change identity and settled decisions: `context/changes/ai-flashcard-review/change.md`
- Roadmap slice S-02: `context/foundation/roadmap.md:93`
- Product story and generation requirements: `context/foundation/prd.md:47`
- Generation non-functional requirements: `context/foundation/prd.md:99`
- OpenRouter and Worker constraints: `context/foundation/infrastructure.md:17`
- Protected dashboard: `src/pages/dashboard.astro:1`
- Central route protection: `src/middleware.ts:4`
- Same-origin mutation guard: `src/lib/auth.ts:29`
- Typed Supabase server client: `src/lib/supabase.ts:6`
- Existing durable flashcard contract: `supabase/migrations/20260815000000_create_flashcards.sql:1`
- Existing ownership verification: `scripts/verify-flashcard-rls.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: AI Generation Foundation

#### Automated

- [x] 1.1 Astro generates current environment and route types successfully: `npx astro sync` — b08c0d4
- [x] 1.2 Type-aware lint accepts provider, validation, and endpoint code: `npm run lint` — b08c0d4
- [x] 1.3 Cloudflare-targeted build succeeds with server-only OpenRouter imports: `npm run build` — b08c0d4

#### Manual

- [x] 1.4 Valid same-language source text returns 1–15 normalized proposals within the 200/500 field limits — b08c0d4
- [x] 1.5 Source boundaries at 999, 1,000, 10,000, and 10,001 characters behave as specified — b08c0d4
- [x] 1.6 Auth, origin, JSON, structured-output configuration, timeout, provider, malformed-output, and zero-result — b08c0d4
      failures are safe
- [x] 1.7 Sparse 1–4 card output succeeds without padding — b08c0d4

### Phase 2: Generation and Review Interface

#### Automated

- [x] 2.1 Astro synchronizes the dashboard island and component contracts: `npx astro sync` — 0d79fa8
- [x] 2.2 Type-aware ESLint and accessibility rules pass: `npm run lint` — 0d79fa8
- [x] 2.3 Production build emits the dashboard workflow for Cloudflare Workers: `npm run build` — 0d79fa8

#### Manual

- [x] 2.4 Signed-in desktop generation shows continuous progress and same-language proposals — 0d79fa8
- [x] 2.5 Source guidance, character count, focus order, keyboard controls, errors, and announcements are usable — 0d79fa8
- [x] 2.6 Proposals support edit, accept, reject, restore, and reject-all behavior — 0d79fa8
- [x] 2.7 Starting over protects unsaved edits while recoverable failure preserves source text — 0d79fa8
- [x] 2.8 Edited question and answer boundaries are enforced — 0d79fa8

### Phase 3: Atomic Persistence and End-to-End Verification

#### Automated

- [x] 3.1 Existing flashcard ownership verification still passes: `npm run db:verify-rls`
- [x] 3.2 Astro type synchronization succeeds: `npx astro sync`
- [x] 3.3 Type-aware lint succeeds: `npm run lint`
- [x] 3.4 Cloudflare-targeted production build succeeds: `npm run build`
- [x] 3.5 Working-tree inspection contains no OpenRouter key, source text fixture, or generated user content

#### Manual

- [x] 3.6 Saving 1 and 15 cards creates exactly those owner-visible rows with correct front/back mapping
- [x] 3.7 Rejecting all proposals performs no insert and leaves the workflow usable
- [x] 3.8 Invalid input or confirmed database failure saves zero rows; retry is idempotent, and lost success responses
      reconcile by owner-scoped UUID lookup without duplicates
- [x] 3.9 Cross-user and anonymous access remain denied
- [x] 3.10 Browser refresh and logs retain no source or generated content
- [x] 3.11 Complete login, generation, review, and atomic-save flow works in a modern desktop browser
