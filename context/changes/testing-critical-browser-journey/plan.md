# Critical Browser Journey Implementation Plan

## Overview

Add a minimal, reproducible Playwright suite for the three browser-level risks left by the phased test rollout: visible
recovery from invalid AI generation, selected-card durability after a failed save, and isolation between anonymous,
owner, and other-user browser sessions. The suite will keep authentication, cookies, Astro routing, hydration, and the
local Supabase database real while mocking only deterministic UI-facing failure inputs.

## Current State Analysis

Playwright 1.63.0 and Chromium execution are already configured, but the project-wide
`playwright/.auth/auth.json` dependency is generated manually and cannot support clean-clone execution or a second
user. The sole browser seed proves that one manually created card survives reload, while existing Vitest, handler, and
ordinary-client database suites separately cover generation decoding, save reconciliation, and RLS. The missing
evidence is how those established contracts behave through real browser cookies, middleware, routing, hydration, and
rendered state.

## Desired End State

`npm run test:e2e -- --project=chromium` can run against an isolated local Supabase stack without pre-existing users or
stored sessions. Three independent tests protect risks #1, #3, and #4, clean up their own identities and rows, and make
only the claims supported by their real versus mocked boundaries. The test-plan cookbook identifies the canonical
files, prerequisites, commands, and evidence limits.

### Key Discoveries:

- Protected dashboard pages depend on server-verified cookie sessions in `src/middleware.ts:4`, while collection APIs
  enforce their own unauthenticated responses in `src/pages/api/flashcards/collection.ts:78`.
- The current Playwright project consumes one ignored, machine-local state file at `playwright.config.ts:16`; no setup
  regenerates it after a database reset.
- `FlashcardWorkspace` preserves source and proposal state after generation and save errors, then filters persistence to
  accepted, valid proposals in `src/components/flashcards/FlashcardWorkspace.tsx:55` and
  `src/components/flashcards/FlashcardWorkspace.tsx:110`.
- Browser routing can deterministically mock `/api/flashcards/generate`, but it cannot intercept the server-side
  OpenRouter request made in `src/lib/openrouter.ts:39`; provider decoding remains owned by the existing Vitest suite.
- Deleting a transient auth user removes its cards through the existing `ON DELETE CASCADE` ownership contract in
  `supabase/migrations/20260815000000_create_flashcards.sql:1`.

## What We're NOT Doing

- Automating signup, email delivery, PKCE confirmation, password recovery, or session-refresh edge cases.
- Claiming that a mocked generation response proves the real generation endpoint or OpenRouter decoder.
- Adding cross-owner PATCH or DELETE browser checks; existing handler and ordinary-client RLS suites remain canonical
  for mutation denial and unchanged-owner-state evidence.
- Changing the current behavior that silently excludes accepted-but-invalid proposals when other valid proposals are
  saved.
- Adding Firefox or WebKit projects, visual regression coverage, CI wiring, deployment checks, or cloud infrastructure.
- Changing production UI, API contracts, database schema, dependencies, or anything under `context/archive/`.

## Implementation Approach

First replace the shared stored session with a test-scoped Playwright fixture. For every test, the fixture will create a
unique confirmed local user with the service-role client, authenticate that user through the real application sign-in
endpoint, provide the resulting in-memory `storageState` to the browser, and delete only that fixture user during
teardown. A helper will create a second isolated context for the ownership scenario. Privileged access is limited to
fixture provisioning and cleanup; all assertions use ordinary browser sessions.

Then add one independently runnable Chromium test per named risk. Risk #1 uses deterministic application-endpoint
responses and asserts only browser recovery. Risk #3 promotes `seed.spec.ts` into the canonical edit/select/fail/retry/
reload journey, with the retry crossing the real API and database. Risk #4 combines anonymous page/API denial with
owner/other-user rendered collection isolation. Finally, update only the Phase 4 cookbook/status portions of the
foundation test plan and run the complete local gates.

## Critical Implementation Details

### State sequencing

The risk #3 save interception must apply to exactly the first save request. The subsequent retry must reach the real
Astro endpoint with the same proposal identity and edited content; otherwise the test proves recovery UI but not durable
persistence.

### Debug & observability

Absence assertions are valid only after a positive collection-loaded signal or the real collection GET completes.
Authentication support must reject non-loopback `SUPABASE_URL` values before using the service role and must never log
credentials, tokens, or serialized storage state.

## Phase 1: Reproducible Playwright Authentication and Isolation

### Overview

Make the existing Playwright setup self-contained and safe for local database mutation. This is non-browser scaffolding
and should be executed with `/10x-implement testing-critical-browser-journey phase 1`.

### Changes Required:

#### 1. Chromium project configuration

**File**: `playwright.config.ts`

**Intent**: Remove the dependency on a manually generated global auth file while preserving the existing Chromium,
base URL, web server, trace, retry, and local server-reuse behavior.

**Contract**: The only product browser project remains `chromium`; authentication is supplied by the imported custom
test fixture rather than a project-wide `playwright/.auth/auth.json` option.

#### 2. Local authenticated-session fixture

**File**: `tests/e2e/fixtures.ts`

**Intent**: Provide unique, confirmed local users and isolated authenticated browser state for every test, plus a helper
for an independently authenticated second context.

**Contract**: The fixture loads `.env` and `.dev.vars`, requires the Supabase URL, anon key, service-role key, and
non-empty test-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values, rejects any non-loopback Supabase host, creates
users with collision-resistant identifiers, signs in through
`/api/auth/signin` with the exact application Origin, passes `storageState` without committing it, and deletes only the
current test's user IDs during teardown. The OpenRouter values only enable the rendered generation controls; browser
routing must be installed before generation and prevents these tests from contacting the provider. Privileged clients
may provision and clean up but may not make risk assertions. The fixture's default page receives the primary user's
state; an anonymous context must pass an explicit empty `{ cookies: [], origins: [] }` storage state so Playwright does
not inherit the primary user, while each additional authenticated context must pass that user's explicit storage state.
Every user ID is registered for cleanup immediately after successful creation. Teardown closes auxiliary contexts,
attempts a hard delete for every registered user even if an earlier deletion fails, and fails the test after all cleanup
attempts if any deletion returned an error.

#### 3. Seed compatibility

**File**: `tests/e2e/seed.spec.ts`

**Intent**: Keep the existing seed runnable while switching it to fixture-owned authentication and cleanup, without yet
expanding its persistence scenario.

**Contract**: The seed imports `test` and `expect` from `tests/e2e/fixtures.ts`, uses unique test data, has no dependency
on a pre-existing auth file, and remains independently runnable after a database reset.

### Success Criteria:

#### Automated Verification:

- Playwright discovers the seed under Chromium: `npm run test:e2e -- --list --project=chromium`.
- A reset-based seed run passes, teardown reports any user-deletion failure before the trailing safety reset, and no
  fixture identity or flashcard remains:
  `npm run db:reset && npm run test:e2e -- tests/e2e/seed.spec.ts --project=chromium && npm run db:reset`.
- Astro synchronization, lint, checking, and production build pass:
  `npx astro sync && npm run lint && npx astro check && npm run build`.

#### Manual Verification:

- Running fixture provisioning with a non-loopback Supabase URL is refused before privileged access.
- No credentials, tokens, storage-state files, reports, or fixture manifests appear in Git status.
- The seed remains a clear exemplar of accessible locators, state-based waits, isolation, and cleanup.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
before proceeding. Phase 2 should be driven with `/10x-e2e`.

---

## Phase 2: Risk #1 — Invalid Generation Recovery

### Overview

Add one browser test proving that invalid generation leaves the workspace recoverable and that a following valid result
remains usable. Execute with `/10x-e2e testing-critical-browser-journey phase 2`.

### Changes Required:

#### 1. Recoverable generation scenario

**File**: `tests/e2e/invalid-generation-recovery.spec.ts`

**Intent**: Protect the visible recovery behavior without calling the nondeterministic external AI provider or
duplicating its decoder matrix.

**Contract**: One independently runnable test uses the authenticated fixture, intercepts the first application
generation request with a representative invalid-output error and the next with valid proposals, then proves the exact
source remains editable, the accessible error is visible, retry is available, and the valid proposals can be edited and
selected. It uses role/label/text locators, state waits, a risk/provenance header, and no structural selectors or fixed
timeouts.

### Success Criteria:

#### Automated Verification:

- The risk #1 spec passes independently:
  `npm run test:e2e -- tests/e2e/invalid-generation-recovery.spec.ts --project=chromium`.
- A temporary break to source preservation or recovery controls makes the risk #1 spec fail, and reverting the break
  restores green.
- Existing generation integration tests remain green:
  `npm run test -- tests/integration/flashcards/generate.test.ts tests/integration/flashcards/FlashcardWorkspace.test.tsx`.

#### Manual Verification:

- The error, retained source, retry action, and recovered proposal state are understandable in rendered Chromium.
- Review confirms the spec claims browser recovery only and does not claim real endpoint or OpenRouter decoding.

**Implementation Note**: Complete the `/10x-e2e` plan → generate → anti-pattern review → deliberate-break verification
cycle, then pause for human confirmation.

---

## Phase 3: Risk #3 — Selected-Card Failure Recovery and Durability

### Overview

Promote the seed into the canonical browser journey for selected edits, confirmed save failure, real retry, and durable
collection state. Execute with `/10x-e2e testing-critical-browser-journey phase 3`.

### Changes Required:

#### 1. Canonical selected-card seed

**File**: `tests/e2e/seed.spec.ts`

**Intent**: Prove that the reviewed set survives a failed save and that exactly the valid selected edit persists after a
real retry and reload.

**Contract**: The seed contains one test. It supplies a deterministic mixed proposal set, edits one accepted card,
rejects another, and leaves a third accepted but invalid. It asserts that the outgoing save intent contains only the
edited valid card, intercepts exactly the first save with `save_failed`, verifies all reviewed states remain visible,
then lets the retry reach the real `/api/flashcards/save` endpoint. After real collection navigation and reload, it
asserts the edited card is present and the rejected and accepted-invalid cards are absent. Fixture teardown owns cleanup
even when assertions fail.

### Success Criteria:

#### Automated Verification:

- The canonical risk #3 seed passes independently:
  `npm run test:e2e -- tests/e2e/seed.spec.ts --project=chromium`.
- The first and retry save bodies carry the same selected proposal identity and edited content, while only the retry
  reaches the real endpoint and database.
- A temporary break to selection shaping, failed-save retention, or reload durability makes the seed fail, and reverting
  the break restores green.
- Existing save and workspace integration tests remain green:
  `npm run test -- tests/integration/flashcards/save.test.ts tests/integration/flashcards/FlashcardWorkspace.test.tsx`.

#### Manual Verification:

- The seed remains a readable exemplar with one setup/action/assertion/cleanup flow and no shared-state, brittle-selector,
  fixed-wait, hallucinated-assertion, or missing-cleanup anti-pattern.
- The rendered post-failure state clearly retains the edited, rejected, and accepted-invalid proposals before retry.

**Implementation Note**: The frozen accepted-invalid proposal after successful save must not be interpreted as persisted;
the authoritative persistence assertions occur in the collection after its GET completes. Pause after the `/10x-e2e`
verification cycle for human confirmation.

---

## Phase 4: Risk #4 — Anonymous and Cross-Account Read Isolation

### Overview

Add one browser test for anonymous page/API denial and rendered owner/other-user collection isolation. Execute with
`/10x-e2e testing-critical-browser-journey phase 4`.

### Changes Required:

#### 1. Browser ownership-isolation scenario

**File**: `tests/e2e/ownership-isolation.spec.ts`

**Intent**: Prove the cookie, middleware, endpoint-authentication, rendered collection, and database-read boundaries that
cannot be established by the lower-level suites alone.

**Contract**: One independently runnable test uses a fresh unauthenticated context to prove the protected collection
page redirects to sign-in and the collection API returns its unauthenticated envelope. It then uses isolated owner and
other-user states: the owner persists a uniquely identifiable card, the other user's collection reaches a positive
loaded state without rendering that card, and the owner's reloaded collection still renders the exact content. No
cross-owner PATCH or DELETE request is issued or claimed. The unauthenticated context uses explicit empty storage state,
the other-user context uses its own explicit state, and all auxiliary contexts close before fixture teardown deletes
their users.

### Success Criteria:

#### Automated Verification:

- The risk #4 spec passes independently:
  `npm run test:e2e -- tests/e2e/ownership-isolation.spec.ts --project=chromium`.
- Anonymous navigation ends at `/auth/signin`, and anonymous collection API access returns the stable 401 envelope.
- The other-user loaded collection excludes the unique owner card, while the owner's reloaded collection retains it.
- A temporary break to protected routing, API authentication, or owner-scoped read isolation makes the spec fail, and
  reverting the break restores green.
- Existing ownership verification remains green:
  `npm run db:reset && npm run db:verify-rls && npm run db:reset`.

#### Manual Verification:

- The anonymous and other-user views disclose no owner card content or identity.
- Review confirms browser claims are limited to read isolation; mutation-denial evidence remains attributed to the
  existing RLS and handler suites.

**Implementation Note**: An immediate `not.toBeVisible()` is insufficient while the collection is loading. Establish a
positive loaded state or await the real collection response before asserting absence, then pause for human confirmation.

---

## Phase 5: Cookbook Handoff and Complete Local Gates

### Overview

Record the shipped patterns and validate the three-risk suite as a whole. This documentation and gate phase should be
executed with `/10x-implement testing-critical-browser-journey phase 5`.

### Changes Required:

#### 1. Critical browser journey cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 4 cookbook placeholder with the canonical browser-test contract and close the rollout only
after the full gate succeeds.

**Contract**: Section 6.6 names `tests/e2e/fixtures.ts`, `tests/e2e/seed.spec.ts`,
`tests/e2e/invalid-generation-recovery.spec.ts`, and `tests/e2e/ownership-isolation.spec.ts`; documents local Supabase
and service-role prerequisites, non-empty test-only OpenRouter values, Chromium commands, fixture isolation and cleanup,
mocked versus real boundaries, the guarantee that browser-routed generation tests do not contact OpenRouter, and the
rule that lower layers remain authoritative for provider decoding and mutation denial. It records that fixture teardown
hard-deletes every registered user and turns any deletion error into a test failure before the final safety reset. The
Phase 4 rollout row moves from its current state to `complete`; frozen strategy sections and unrelated rollout phases
remain unchanged.

### Success Criteria:

#### Automated Verification:

- Playwright lists exactly three risk-bound Chromium tests in three files:
  `npm run test:e2e -- --list --project=chromium`.
- The complete browser gate passes against a reset local stack:
  `npm run db:reset && npm run test:e2e -- --project=chromium && npm run db:reset`.
- Database contracts and ordinary-client ownership verification pass:
  `npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls && npm run db:reset`.
- Application tests and repository checks pass:
  `npx astro sync && npm run test && npm run lint && npx astro check && npm run build`.
- The cookbook paths, test count, prerequisites, commands, and claim boundaries match the implemented suite.

#### Manual Verification:

- A clean local run needs no manually prepared account or auth state and leaves no fixture users/cards or tracked
  secrets/artifacts.
- The three specs remain independently runnable, order-independent, and tied one-to-one to risks #1, #3, and #4.
- The test plan documents Chromium-only local coverage and does not imply CI, cross-browser, provider, or cross-owner
  mutation coverage.

**Implementation Note**: Update the rollout status only after every preceding phase and the complete local gate pass.
Pause for final human confirmation before closing the change.

---

## Testing Strategy

### Unit Tests:

- No new unit tests are planned; parsing, proposal validity, and request-shaping contracts already have Vitest coverage.
- Re-run the focused generation, workspace, save, and ownership suites when their browser counterparts land.

### Integration Tests:

- Keep auth, Astro middleware, hydration, application routing, successful save/retry, collection GET, and local Supabase
  persistence real.
- Mock the application generation endpoint for deterministic invalid/valid UI states and only the first save response for
  deterministic failure retention.
- Preserve existing handler and ordinary-client suites as the canonical evidence for provider decoding, save
  classification, exact RLS mutation denial, and database invariants.

### Manual Testing Steps:

1. Reset and start the isolated local Supabase stack with loopback credentials and the service-role key configured; set
   non-empty test-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values so the mocked generation controls are enabled.
2. Run each risk spec independently under Chromium and confirm fixture identities and cards are removed afterward.
3. Run the full three-spec suite in arbitrary order and confirm the same result without a pre-existing auth file.
4. Inspect traces from a deliberate failure only; confirm no credentials, cookies, or tokens enter tracked artifacts.
5. Compare the completed cookbook statements with the evidence actually produced by each real and mocked boundary.

## Performance Considerations

Keep the gate to one Chromium test per named risk. Per-test identity provisioning adds local setup cost but prevents
shared-state flakiness and makes retries/order changes safe; no browser-matrix or provider latency is introduced.

## Migration Notes

No database, data, dependency, or production migration is required. Existing ignored auth/output artifacts may be
discarded locally once the fixture no longer consumes `playwright/.auth/auth.json`.

## References

- Rollout strategy and risks: `context/foundation/test-plan.md:8`
- Change definition: `context/changes/testing-critical-browser-journey/change.md:10`
- Existing Playwright configuration: `playwright.config.ts:3`
- Existing seed: `tests/e2e/seed.spec.ts:3`
- Browser workspace behavior: `src/components/flashcards/FlashcardWorkspace.tsx:45`
- Authentication boundary: `src/pages/api/auth/signin.ts:5`
- Collection boundary: `src/pages/api/flashcards/collection.ts:78`
- Ownership policy: `supabase/migrations/20260815000000_create_flashcards.sql:28`
- Existing real-boundary verifier: `scripts/verify-flashcard-rls.mjs:126`
- Playwright web server configuration: https://playwright.dev/docs/test-webserver
- Playwright authentication and storage state: https://playwright.dev/docs/auth
- Downstream browser workflow: `.agents/skills/10x-e2e/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `.agents/skills/10x-plan/references/progress-format.md`.

### Phase 1: Reproducible Playwright Authentication and Isolation

#### Automated

- [x] 1.1 Playwright discovers the seed under Chromium — 4ebaa74
- [x] 1.2 Reset-based seed run passes and cleans fixture state — 4ebaa74
- [x] 1.3 Astro synchronization, lint, checking, and production build pass — 4ebaa74

#### Manual

- [x] 1.4 Non-loopback Supabase provisioning is refused — 4ebaa74
- [x] 1.5 Credentials and generated artifacts remain untracked — 4ebaa74
- [x] 1.6 Seed demonstrates accessible, isolated, state-driven patterns — 4ebaa74

### Phase 2: Risk #1 — Invalid Generation Recovery

#### Automated

- [x] 2.1 Risk #1 spec passes independently — 88e7ffb
- [x] 2.2 Deliberate recovery break makes the spec fail and reverting restores green — 88e7ffb
- [x] 2.3 Existing generation integration tests remain green — 88e7ffb

#### Manual

- [x] 2.4 Rendered generation recovery is understandable — 88e7ffb
- [x] 2.5 Spec claims only the browser recovery boundary it proves — 88e7ffb

### Phase 3: Risk #3 — Selected-Card Failure Recovery and Durability

#### Automated

- [x] 3.1 Canonical risk #3 seed passes independently — 691b90f
- [x] 3.2 Failed and retried saves preserve identical selected intent — 691b90f
- [x] 3.3 Deliberate selection or durability break makes the seed fail and reverting restores green — 691b90f
- [x] 3.4 Existing save and workspace integration tests remain green — 691b90f

#### Manual

- [x] 3.5 Seed remains free of the five E2E anti-patterns — 691b90f
- [x] 3.6 Rendered failed-save state retains the complete reviewed set — 691b90f

### Phase 4: Risk #4 — Anonymous and Cross-Account Read Isolation

#### Automated

- [x] 4.1 Risk #4 spec passes independently
- [x] 4.2 Anonymous page and API access are denied
- [x] 4.3 Other-user collection excludes the owner card and owner reload retains it
- [x] 4.4 Deliberate access-isolation break makes the spec fail and reverting restores green
- [x] 4.5 Existing ownership verification remains green

#### Manual

- [x] 4.6 Anonymous and other-user views disclose no owner data
- [x] 4.7 Browser claims remain limited to read isolation

### Phase 5: Cookbook Handoff and Complete Local Gates

#### Automated

- [ ] 5.1 Playwright lists exactly three risk-bound Chromium tests
- [ ] 5.2 Complete browser gate passes against a reset local stack
- [ ] 5.3 Database and ordinary-client ownership gates pass
- [ ] 5.4 Application tests and repository checks pass
- [ ] 5.5 Cookbook matches the implemented suite and evidence boundaries

#### Manual

- [ ] 5.6 Clean local run leaves no fixture or secret artifacts
- [ ] 5.7 Specs remain independent and mapped one-to-one to risks
- [ ] 5.8 Test plan states the deliberate browser-coverage limits
