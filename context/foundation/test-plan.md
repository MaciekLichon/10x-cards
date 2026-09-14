# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-13

## 1. Strategy

1. **Cost × signal.** Use the cheapest test that gives a real signal. Promote to browser tests or AI review only for additional evidence.
2. **User concerns are first-class evidence.** Invalid AI responses are the user's priority; collection concerns are secondary. No incidents reported.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Confirmed hot-spot scope: `src/`, excluding generated types. Last 30 days: 18 commits; `src/lib/` 10, `src/pages/api/` 9, `src/components/flashcards/` 7. Broad churn indicates likelihood, not failure ownership.

## 2. Risk Map

High impact means access/data loss or publicly visible failure; Medium means degradation with a workaround; Low means cosmetic impact. Likelihood: High = weekly changes, Medium = occasional changes, Low = stable. These are prospective scenarios, not observed defects.

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Invalid AI output breaks generation or appears usable | High | High | Interview Q1; PRD US-01; `src/lib/` 10 commits/30d |
| 2 | Valid-looking cards misrepresent source meaning | Medium | Medium | Interview Q1; PRD Vision, Success Criteria, Business Logic |
| 3 | Accepted cards disappear or rejected proposals persist | High | High | PRD US-01; `src/components/flashcards/` 7 commits/30d |
| 4 | Anonymous users or other accounts access/change someone else's cards | High | High | PRD Access Control; `src/pages/api/` 9 commits/30d |
| 5 | Review progress disappears or incorrect cards become due | High | Medium | PRD Guardrails, FR-011/012; roadmap S-05 |
| 6 | Editing/deleting a card changes an unintended card | High | Medium | Interview Q3–4; PRD FR-009/010 |

Numbers are stable identifiers, not severity ranks. Phase 1 groups #1–2 around the user's primary concern; subsequent phases protect data and access. Research must challenge broad churn attribution. Semantic validity in #2 is a hypothesis within the user's general validity concern.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Invalid output gives recoverable failure; valid cards remain usable | HTTP success means valid cards | Format, provider boundary, error/UI recovery | Contract + integration | Happy-path-only |
| #2 | Questions are answerable and preserve source meaning | Valid structure means correctness | Source samples, independent human rubric | Human sample review; selective AI assistance | Model judging itself without calibration |
| #3 | Only selected edits persist; failed saves remain visible | Success feedback proves durability | Selection, persistence, error behavior | Integration | Response-only assertions |
| #4 | Denied access leaves owner data private and intact | Login proves ownership | Sessions, ownership, existing database checks | Database + API integration | Mocked authorization |
| #5 | Confirmed ratings survive sessions; due selection follows contract | Successful rating proves next-session correctness | Rating contract, persistence, time boundaries | Deterministic integration | Copying scheduler calculations |
| #6 | Only the intended card changes; failures stay visible | UI removal proves correct deletion | Target identity, mutations, failure feedback | Integration | UI-only assertions |

Expected outcomes come from requirements and independent fixtures, never production calculations. No safeguard is assumed to exist. Provider availability and missing rate limiting are outside this rollout.

## 3. Phased Rollout

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | AI generation validity | Reject unusable output, recover cleanly, assess source fidelity | #1, #2 | Contract/integration; human rubric; selective AI review | complete | context/changes/testing-ai-generation-validity/ |
| 2 | Collection persistence and ownership | Preserve selected cards and isolate reads/mutations | #3, #4, #6 | Database + API integration | complete | context/changes/testing-collection-persistence-and-ownership/ |
| 3 | Review continuity | Preserve progress and respect due dates | #5 | Integration | complete | context/changes/testing-review-continuity/ |
| 4 | Critical browser journey | Prove auth, generation, persistence, and ownership crossings in the browser | Journey across #1/#3/#4 | Minimal e2e | complete | context/changes/testing-critical-browser-journey/ |

Phase 1 adds only necessary runner setup. Reuse existing checks. Each phase ends by updating §6. Status vocabulary: `not started`, `change opened`, `researched`, `planned`, `implementing`, `complete`.

## 4. Stack

**Test base: sparse.** Two SQL test files and three verification scripts; no application runner. Manifest: Astro ^6.3.1, React ^19.2.6, Supabase JS ^2.99.1, ts-fsrs 5.4.2; Cloudflare adapter ^13.7.0. These are declared versions, not lockfile verification.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| Contract/integration | Vitest candidate | Select in Phase 1 | Astro rendering requires server environment; checked: 2026-09-06 |
| Database | Supabase CLI / pgTAP | CLI ^2.23.4 declared | Existing `db:test`; checked: 2026-09-06 |
| Browser | Playwright candidate | Select in Phase 4 | Only browser-specific signal; checked: 2026-09-06 |
| AI-assisted quality | Human-calibrated rubric review | No tool selected | Phase 1 feasibility check. When NOT to use: deterministic format checks, cheap human review, or uncalibrated judgments; checked: 2026-09-06 |

**Stack grounding tools (current session), checked: 2026-09-06:**
- Docs: Context7 checked [Astro testing](https://docs.astro.build/en/guides/testing/), [Astro 6 constraints](https://docs.astro.build/en/guides/upgrade-to/v6/), and [Supabase testing](https://supabase.com/docs/guides/database/testing).
- Search: Exa/web available; unnecessary after official docs retrieval.
- Runtime/browser: no callable browser automation tool exposed; not used.
- Provider/platform: no relevant GitHub/Cloudflare/Supabase connector exposed; not used.

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| Existing sync, lint, typecheck, build | Local `deploy:check` | Existing; preserve | Type/build errors |
| Generation contract/integration | Local | Required after Phase 1 | #1 |
| Source-fidelity rubric | Local, selective | Manual sample check after Phase 1; AI advisory | #2 |
| Persistence/ownership integration | Local | Required after Phase 2 | #3/#4/#6 |
| Review integration | Local | Required after Phase 3 | #5 |
| Critical e2e | Local | Required after Phase 4 | Browser crossings across #1/#3/#4 |

Repository rules also require sync, lint and build before PRs. The documented GitHub Actions workflow is absent; external enforcement is unverified. No CI gate is claimed. CI wiring, configuration testing and infrastructure investment are excluded by interview Q5; changing that requires explicit rescoping.

## 6. Cookbook Patterns

### 6.1 Invalid generation output and recovery

Application tests use Vitest 4.1.6, jsdom 27.4.0, React Testing Library 16.3.0, DOM Testing Library 10.4.1, and
user-event 14.6.7 (resolved versions; checked: 2026-09-11). Name Node/API tests `*.test.ts` and React component tests
`*.test.tsx` under `tests/`. The canonical references are
`tests/integration/flashcards/generate.test.ts` and
`tests/integration/flashcards/FlashcardWorkspace.test.tsx`.

The API suite stubs only the external OpenRouter `fetch`, retaining the real endpoint, adapter, decoding, and proposal
validation. The component suite stubs only `/api/flashcards/generate`, retaining the real workspace and child
components. Both suites restore stubs after each test and must never access the network. Run:

```bash
npm run test
npm run test -- tests/integration/flashcards/generate.test.ts
npm run test -- tests/integration/flashcards/FlashcardWorkspace.test.tsx
```

These tests cover structural rejection, usable survivors, and visible recovery. They do not prove source fidelity,
authentication/cookies, persistence, ownership, or a full browser journey.

### 6.2 Source-fidelity assessment

The revision-1 corpus is under `tests/quality/ai-generation/`: three synthetic sources in `sources/`, independent
expectations in `reference-facts.md`, the fidelity rules in `rubric.md`, the record shape in `review-template.md`, and
the complete procedure in `README.md`. Maciek approved the sources, expectations, and rubric without changes on
2026-09-11. The first live review is `reviews/2026-09-11-conditions-pl.md`; its batch fidelity result is `fail` because
Card 3 altered the relationship between two required deletion fields. The finding is tracked locally in
`context/changes/fix-protected-entry-deletion-card-fidelity/`.

Procedure: approve the exact source/reference/rubric revisions; run `npm run dev` in an already configured environment;
sign in at `/dashboard`; generate one set from one approved sample; retain every unedited card without saving it to the
collection; then assess every card and the batch using a copied review template. Fidelity is pass/fail/unresolved and
separate from descriptive usefulness. A provider failure is `no result`, not a semantic verdict, and an unfavorable
set is retained rather than retried for a better result.

The live review is selective, not part of `npm run test` and not required per edit. Consider AI assistance only after
calibration against human labels demonstrates additional signal. **When NOT to use:** format validation, inexpensive
human review, or an uncalibrated judgment. No AI judge selected; checked: 2026-09-11.

### 6.3 Accepted-card persistence and ownership

Use three complementary references. `scripts/verify-flashcard-rls.mjs` is the canonical real-boundary check for exact
durable rows, conflicting-batch atomicity, and owner/other-user/anonymous isolation. It runs as one reset-based scenario
with two confirmed local users, deterministic UUIDs, literal expected rows, and complete owner snapshots before and after
denied writes. `tests/integration/flashcards/save.test.ts` and
`tests/integration/flashcards/collection.test.ts` are the canonical direct-handler references for batch/manual request
shaping, validation envelopes, exact reconciliation, timestamp DTOs, and no insert replay. Selection and visible recovery
belong to `tests/integration/flashcards/FlashcardWorkspace.test.tsx`, whose mixed reviewed fixture keeps edited accepted,
rejected, and accepted-invalid proposals independent from production calculations.

The real-boundary check requires an isolated local Supabase stack plus loopback `SUPABASE_URL` and `SUPABASE_KEY` in
`.env` or `.dev.vars`. Reset before the run and again afterward to remove transient users and rows. Run:

```bash
npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run db:verify-rls
npm run test -- tests/integration/flashcards/save.test.ts tests/integration/flashcards/collection.test.ts tests/integration/flashcards/FlashcardWorkspace.test.tsx
```

Claim boundaries are strict. The privileged pgTAP contract in `supabase/tests/database/flashcards.test.sql` proves schema,
policy/grant shape, constraints, and database invariants, but not runtime RLS behavior. The ordinary-client verifier proves
local PostgREST/RLS and durable-state behavior, but not Astro authentication, cookies, origin checks, or visible UI state.
Direct-handler tests mock `@/lib/supabase` and therefore never prove RLS. The React suite proves selected-set shaping and
visible recovery, but not database durability or authorization.

### 6.4 Collection mutations

`tests/integration/flashcards/mutations.test.ts` is the canonical request-boundary reference for PATCH/DELETE validation,
exact `id + updated_at` predicates, public DTOs, stale conflicts, non-disclosing missing/cross-owner responses, and
ambiguous classification. `tests/integration/flashcards/FlashcardCollection.test.tsx` is the canonical visible-behavior
reference for exact draft retention, target-scoped errors, target-only success, and read-only reconciliation without
mutation replay. The durable target/decoy invariant remains in `scripts/verify-flashcard-rls.mjs`.

Keep fixtures explicit: stable target and decoy UUIDs, literal versions and expected DTO timestamps, and queued fetch
responses with the initial collection GET before each mutation. Expected state must be written independently rather than
derived through production mapping or mutation helpers. Run:

```bash
npm run test -- tests/integration/flashcards/mutations.test.ts tests/integration/flashcards/FlashcardCollection.test.tsx
npm run db:reset && npm run db:verify-rls
```

The mocked handler suite proves predicates and response classification, not ownership enforcement or RLS. The React suite
proves which card and draft remain visible and that ambiguous writes are not replayed, not durable database state. Only the
local ordinary-client verifier may support RLS and target/decoy durability claims; it does not prove browser, cookie, or
Astro middleware behavior.

### 6.5 Review progress and due selection

Use five complementary references. `tests/integration/review/fsrs.test.ts` fixes the application-owned `ts-fsrs` adapter
to literal outputs for ratings 1–4 and a second transition. `tests/integration/review/rate.test.ts` exercises the direct
Astro handler with the real scheduler in its core path and narrow mocked persistence/session seams.
`tests/integration/review/SpacedRepetitionSession.test.tsx` proves confirmed-only visible progress, byte-equivalent retry
intent, conflict reconciliation, and due-time reload triggers. `supabase/tests/database/spaced_repetition.test.sql` owns
literal due, 60-second wait, 24-hour expiry, transaction, and function-order contracts. Finally,
`scripts/verify-spaced-repetition.mjs` exercises ordinary-client isolation plus concurrent rating calls through local
PostgREST and inspects exact durable state.

Keep scheduler inputs, expected post-state, timestamps, UUIDs, and boundary values literal and independent from production
calculation helpers. Freeze application time at the owning layer. For one stable rating intent, concurrent calls must yield
one applied result, one canonical replay, one schedule/member/session increment, and one log. The bounded concurrent
verifier is practical scheduling evidence; the pgTAP function-definition assertion separately protects that the
request-scoped advisory lock precedes replay lookup.

The database gate requires an isolated, resettable local Supabase stack; loopback `SUPABASE_URL`, `SUPABASE_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` must be available through `.env` or `.dev.vars`. Reset before and after the verifier so its
temporary users and rows do not survive. Run:

```bash
npm run test -- tests/integration/review/fsrs.test.ts tests/integration/review/rate.test.ts tests/integration/review/SpacedRepetitionSession.test.tsx
npm run test && npm run verify:fsrs
npm run db:reset && npm run db:lint && npm run db:test && npm run db:types:check && npm run verify:spaced-repetition && npm run db:reset
npm run deploy:check
```

Claim boundaries are strict. The scheduler suite proves deterministic adapter mapping, not vendor internals. Direct-handler
tests mock the admin/session seams and therefore do not prove RLS, durability, cookies, middleware, or deployed routing.
The React suite uses jsdom and mocked fetch, so it proves component reconciliation but not real networking, hydration,
focus, cross-page behavior, authentication, or database state. pgTAP proves privileged database contracts, while the
ordinary-client verifier proves local PostgREST/RLS and durable behavior; neither proves the browser journey. Authentication
cookies, middleware, hydration, routing, and full user journeys remain Phase 4.

### 6.6 Critical browser journey

Playwright 1.63.0 runs exactly three Chromium risk journeys. `tests/e2e/seed.spec.ts` is the canonical project E2E
exemplar and protects risk #3; `tests/e2e/invalid-generation-recovery.spec.ts` protects risk #1; and
`tests/e2e/ownership-isolation.spec.ts` protects risk #4. Shared provisioning and isolation live in
`tests/e2e/fixtures.ts`, with environment validation in `tests/e2e/env.ts`. Each spec is independently runnable and
owns one setup/action/assertion/cleanup flow; unique values prevent collisions during retries, reordered runs, or
parallel execution.

The suite requires an isolated, resettable local Supabase stack. Configure loopback `SUPABASE_URL`, `SUPABASE_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` values in `.env` or `.dev.vars`. Also set non-empty, test-only `OPENROUTER_API_KEY` and
`OPENROUTER_MODEL` values so the rendered generation controls are enabled. The environment guard refuses non-loopback
Supabase hosts before creating a privileged client. No manually prepared account or
`playwright/.auth/auth.json` file is required.

The fixture creates a unique confirmed primary user for every test, signs in through the real
`/api/auth/signin` endpoint, and gives the default page its in-memory cookie state. Additional authenticated contexts
receive their own explicit user state; anonymous contexts must pass the explicit empty state
`{ cookies: [], origins: [] }`. Auxiliary contexts close before user cleanup. Every successfully created user ID is
registered immediately, every registered user is hard-deleted even if an earlier deletion fails, and any deletion
error fails the test before the final safety reset. The foreign-key cascade removes that user's cards.

Run the individual risks or the complete local gate under Chromium:

```bash
npm run test:e2e -- tests/e2e/invalid-generation-recovery.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/seed.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/ownership-isolation.spec.ts --project=chromium
npm run test:e2e -- --list --project=chromium
npm run db:reset && npm run test:e2e -- --project=chromium && npm run db:reset
```

Claim boundaries are strict. Risk #1 browser-routes both deterministic generation responses, and risk #3
browser-routes its deterministic proposal response plus only the first failed save; these intercepted generation
requests never contact OpenRouter. Risk #3's retry reaches the real Astro save endpoint and local database. Risk #4
keeps application sign-in, cookies, middleware, anonymous API denial, rendered collection loads, and owner persistence
real. These Chromium journeys prove visible recovery, selected-card retry durability, and rendered anonymous/other-user
read isolation. The lower-level generation suites remain authoritative for OpenRouter response decoding, while the
handler, pgTAP, and ordinary-client RLS suites remain authoritative for cross-owner mutation denial. This is local,
Chromium-only coverage: it does not claim CI, Firefox/WebKit, visual-regression, real-provider, or cross-owner browser
mutation evidence.

## 7. What We Deliberately Don't Test

- **Configuration** — no configuration-specific suite; minimal test-runner setup is allowed to enable product tests. Revisit if configuration becomes a stated product risk. (Interview Q5.)
- **External tools** — no vendor SDK, model availability or scheduler-internals testing. Test the application's observable boundary behavior; source-fidelity samples assess product usefulness. Revisit after a demonstrated contract failure. (Interview Q5.)
- **Infrastructure** — no deployment/cloud provisioning suite or CI-rebuild phase. Existing local validation remains. Revisit if deployment failures become a priority. (Interview Q5.)
- **Broad visual snapshots and autonomous browser review** — no evidence of additional signal for the accepted risks. Revisit after a critical visual regression.

Interview record: Q1 invalid AI responses threaten the app's purpose; Q2 new project, no known incidents; Q3 generation feels reasonable, deck management tentative; Q4 saving/mutation risks acknowledged but secondary; Q5 exclude configuration, external tools, infrastructure. User accepted this brief on 2026-09-06.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-06.
- Stack declarations and official documentation last checked: 2026-09-06; candidate versions deferred to per-phase research.
- AI-native approach last reviewed: 2026-09-06; no model/tool selected or benchmarked.
- Evidence: `context/foundation/prd.md` (US-01, FR-009–012, Guardrails, Access Control); `context/foundation/roadmap.md` (S-02–05); `context/foundation/tech-stack.md`; `package.json`; `AGENTS.md`; `CLAUDE.md`; `supabase/config.toml`; test-file inventory; scoped git history; interview.
- No archived plans exist. Roadmap still marks review sessions in progress; research must reconcile current implementation. Older stack/rules claims about infrastructure and no tests conflict with current manifest/inventory; no external CI state was verified.

Refresh with `/10x-test-plan --refresh` when a new top-3 risk surfaces, a recommended tool's checked date exceeds three months, the stack changes, or §7 exclusions no longer match the team's priorities. Preserve risk identifiers; each shipped phase fills §6 with verified references.
