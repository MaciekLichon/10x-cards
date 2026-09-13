# Critical Browser Journey — Plan Brief

> Full plan: `context/changes/testing-critical-browser-journey/plan.md`

## What & Why

Add minimal browser evidence for invalid-generation recovery, selected-card durability, and user isolation. Existing
tests prove the relevant layers separately; this change protects the remaining cookie, middleware, routing, hydration,
and rendered-state crossings without turning E2E into a duplicate integration suite.

## Starting Point

Playwright 1.63.0 and one reload-persistence seed exist, but they rely on a machine-local stored session. Vitest and
ordinary-client Supabase tests already cover generation decoding, request shaping, durability, and RLS outside a real
browser.

## Desired End State

A clean local Chromium run provisions its own isolated users, executes three independent risk-bound tests, and removes
all fixture data. The cookbook clearly distinguishes real browser/database evidence from deterministic mocked inputs.

## Key Decisions Made

| Decision              | Choice                                                 | Why                                                                                          |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Authentication        | Prepared confirmed users with real application sign-in | Reproducible storage state exercises session cookies without repeating signup in every test. |
| Accepted-invalid card | Preserve current silent-skip behavior                  | The change remains test-focused and records the existing selected-valid contract.            |
| Invalid AI output     | Mock `/api/flashcards/generate`                        | Deterministic browser recovery is the intended claim; Vitest retains decoder ownership.      |
| Save failure          | Fail once, then persist through the real endpoint      | Proves reviewed-state retention and durable retry in one risk journey.                       |
| Ownership depth       | Rendered collection isolation only                     | Browser evidence covers read privacy; lower layers remain authoritative for mutation denial. |
| Anonymous access      | Protected-page redirect plus collection API 401        | Exercises both middleware and endpoint authentication boundaries.                            |
| Seed strategy         | Promote `seed.spec.ts` into risk #3                    | Preserves the required exemplar without duplicating an expensive persistence flow.           |
| Browser matrix        | Chromium only                                          | Matches the frozen minimal-E2E strategy and limits fixture/runtime cost.                     |

## Scope

**In scope:**

- Test-scoped local users, real application sign-in, isolated in-memory storage state, and teardown.
- One independent Chromium test each for risks #1, #3, and #4.
- Real retry persistence, collection navigation/reload, anonymous denial, and rendered cross-user isolation.
- Phase 4 cookbook/status update after the complete suite passes.

**Out of scope:**

- Signup/email confirmation, session refresh, cross-owner browser mutations, Firefox/WebKit, visuals, CI, and deployment.
- Production UI/API/schema changes and real OpenRouter calls.
- Changing the accepted-but-invalid proposal behavior.

## Architecture / Approach

The Playwright fixture creates confirmed users through a loopback-only service client, signs them in through the real
Astro endpoint, supplies isolated `storageState`, and hard-deletes every registered user afterward with cleanup failures
surfaced as test failures. The default page receives owner state, anonymous contexts receive explicit empty state, and
additional-user contexts receive their own explicit state. Tests keep auth, cookies,
middleware, routing, hydration, successful persistence, and Supabase real; only generation responses and the first
failed save are intercepted for determinism.

## Phases at a Glance

| Phase       | What it delivers                             | Key risk                                                   |
| ----------- | -------------------------------------------- | ---------------------------------------------------------- |
| 1. Fixtures | Reproducible local auth and cleanup          | Privileged setup escaping the local environment            |
| 2. Risk #1  | Invalid generation visibly recovers          | Overclaiming a mocked endpoint as provider evidence        |
| 3. Risk #3  | Selected edit survives failure and reload    | First-save mock accidentally intercepting the real retry   |
| 4. Risk #4  | Anonymous denial and rendered read isolation | False-positive absence before collection loading completes |
| 5. Handoff  | Cookbook and complete local gates            | Documentation claiming evidence the suite does not produce |

**Prerequisites:** Resettable local Supabase, loopback URL, anon key, service-role key, installed Chromium browser, and
non-empty test-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values. Browser routing prevents these tests from
contacting OpenRouter.

**Estimated effort:** Approximately 3–5 focused sessions across five gated phases.

## Open Risks & Assumptions

- Local admin provisioning is available through `SUPABASE_SERVICE_ROLE_KEY`; the fixture must fail safely when absent.
- The first-save interception can be constrained to one request so the retry reaches the real application.
- Existing accessible labels remain sufficient; duplicated proposal labels may require scoped or indexed locators.
- Browser read isolation does not extend the E2E claim to cross-owner mutation denial.

## Success Criteria (Summary)

- Three independent Chromium tests pass from a reset local stack with no manually prepared auth state.
- Invalid generation recovers, exact selected edits persist after a failed save, and owner content is absent from the
  other user's rendered collection.
- Fixture users and cards are removed, and the cookbook accurately records prerequisites and claim boundaries.
