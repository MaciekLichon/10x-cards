---
date: 2026-09-01T21:54:02+02:00
researcher: Codex
git_commit: 72febb53332d32e68c776dfecfe4fdfc6fc86058
branch: main
repository: 10x-cards
topic: "Compatibility of the TS-FSRS implementation reference with the codebase for S-05"
tags: [research, codebase, ts-fsrs, supabase, astro, spaced-repetition]
status: complete
last_updated: 2026-09-01
last_updated_by: Codex
last_updated_note: "Added follow-up research recording the accepted S-05 product and scheduler decisions"
---

# Research: TS-FSRS compatibility for S-05

**Date**: 2026-09-01T21:54:02+02:00
**Researcher**: Codex
**Git Commit**: `72febb53332d32e68c776dfecfe4fdfc6fc86058`
**Branch**: `main`
**Repository**: `10x-cards`

## Research Question

Review the codebase and decide whether `context/changes/spaced-repetition-session/ts-fsrs-docs.md` is compatible with
it for implementing S-05 from `context/foundation/roadmap.md`.

## Summary

**Verdict: compatible in architecture and product direction, but not implementation-ready as written.** `ts-fsrs`
fits the TypeScript/ESM application and the Astro SSR + React-island architecture. Its native Again/Hard/Good/Easy
scale and FSRS v6 scheduler resolve the two explicit S-05 roadmap blockers. The scheduling API described in the note
also matches current Context7 documentation.

The live application cannot implement the persistence portion yet. Flashcards contain only content, ownership, and
timestamps; there is no FSRS state, review-history table, due-card index, or transactional database function. S-05's
no-lost-progress guardrail requires a PostgreSQL transaction/RPC that updates the card and inserts its review log
atomically. It also requires idempotency and stale-state handling so a lost response or double submission cannot apply
one rating twice.

Two statements in `ts-fsrs-docs.md` must be corrected before it becomes planning input:

1. Its serialization example emits epoch milliseconds, while this repository and Supabase schema use PostgreSQL
   `timestamptz` and canonical ISO strings. Use `Date.toISOString()` at the database boundary.
2. Its example config supplies custom parameters, including `enable_fuzz: false`, while its S-05 decision says to use
   `generatorParameters()` defaults. Choose one exported, versioned configuration; defaults are the documented MVP
   decision.

The compatibility spike proposed by the earlier external research is still necessary after installing an exact
`ts-fsrs` version: import the scheduler in server code and run the Cloudflare-targeted production build. The package is
not currently installed, so this research establishes architectural compatibility, not verified bundle compatibility.

## Detailed Findings

### Requirements and roadmap fit

- S-05 requires a session containing due cards, user ratings, and durable progress. The PRD strengthens that contract:
  the application must never lose progress, show another user's card, or show a card outside the current schedule
  ([PRD guardrails](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/context/foundation/prd.md#L40),
  [FR-011/FR-012](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/context/foundation/prd.md#L92)).
- The roadmap blocks S-05 only on the rating scale and ready-made algorithm. Again/Hard/Good/Easy plus FSRS v6 answer
  both questions (`context/foundation/roadmap.md:129-141`). The roadmap may move from `blocked` once the product owner
  accepts those decisions; this research does not edit roadmap status.
- A ready-made scheduler matches the MVP non-goal of building a custom algorithm
  ([PRD business rules](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/context/foundation/prd.md#L108)).

### Runtime and application architecture

- The repository is ESM and uses Astro server rendering through the Cloudflare adapter
  ([package.json](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/package.json#L3),
  [astro.config.mjs](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/astro.config.mjs#L12)).
  Nothing in the scheduler API requires a Node-only persistence layer. Do not add the separate WASI optimizer/binding
  package; current Context7 docs direct scheduling-only workloads to `ts-fsrs`.
- `ts-fsrs` is absent from dependencies, so exact installed-version exports and Cloudflare bundling remain unverified
  ([package.json dependencies](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/package.json#L23)).
- A protected `/dashboard/review` Astro page with one `client:load` React session island follows the existing boundary
  ([dashboard island](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/pages/dashboard.astro#L42)).
  `/dashboard/**` is already protected by prefix matching
  ([middleware](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/middleware.ts#L4)).
- Run FSRS authoritatively in the server rating endpoint. The client should submit a card ID, rating, and
  idempotency/concurrency token, never trusted post-review scheduler state.

### Data-model compatibility

- `flashcards` currently has only `id`, `user_id`, `front`, `back`, `created_at`, and `updated_at`
  ([migration](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/supabase/migrations/20260815000000_create_flashcards.sql#L1)).
  Generated types confirm there are no scheduling columns, review table, or public functions
  ([database types](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/types/database.types.ts#L29)).
- Add persisted `Card` state: `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`,
  `reps`, `lapses`, `state`, nullable `last_review`, and scheduler/config version, with database constraints matching
  package domains.
- Existing cards need a backfill and future AI/manual inserts need database defaults equivalent to an empty FSRS card.
  Using `created_at` as initial `due` makes existing cards eligible without fabricating reviews. Both current creation
  paths insert only content
  ([AI save](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/pages/api/flashcards/save.ts#L71),
  [manual save](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/pages/api/flashcards/collection.ts#L138)).
- Add `(user_id, due, id)` for owner-scoped due selection. Current indexes cover owner lookup and collection pagination,
  not scheduling
  ([owner index](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/supabase/migrations/20260815000000_create_flashcards.sql#L10),
  [collection index](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/supabase/migrations/20260823000000_add_flashcard_collection_index.sql#L1)).

### Review history, ownership, and atomicity

- Add an append-only review-log table with documented pre-review `ReviewLog` fields, `flashcard_id`, internally derived
  `user_id`, unique review/request UUID, scheduler/config version, and creation timestamp.
- Enable RLS: own-row SELECT and INSERT, no UPDATE/DELETE. Preserve database-authoritative ownership
  ([existing RLS](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/supabase/migrations/20260815000000_create_flashcards.sql#L28)).
  A composite `(flashcard_id, user_id)` foreign key should prevent pairing one user's ID with another user's card.
  Decide whether flashcard deletion cascades history or is restricted.
- Two Supabase calls are two transactions. Use one `SECURITY INVOKER` PostgreSQL RPC to conditionally update the owned,
  expected card state and insert the log. Any failure rolls back both. Regenerate database types afterward.
- Use a unique review-event UUID and expected card version/state. This allows reconciliation after a lost response and
  rejects concurrent stale reviews. Existing endpoints already distinguish ambiguous writes and conflicts
  ([mutation handling](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/pages/api/flashcards/%5Bid%5D.ts#L114)).

### Due selection and session contract

- Query only the authenticated user's rows with `due <= serverOwnedCutoff`, deterministic `due, id` ordering, and a
  bounded session size. RLS scopes reads, while the API must reject forged or stale rating requests.
- Freeze one server timestamp per rating request and reuse it for `scheduler.next`, the optimistic precondition, and log.
- Planning still needs decisions for answer reveal, empty sessions, completion, batch size, and whether short-term cards
  due minutes later re-enter the current session.
- Content editing currently preserves identity and changes only front/back. Preserve scheduling progress unless product
  policy explicitly chooses reset
  ([PATCH](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/pages/api/flashcards/%5Bid%5D.ts#L115)).

### Corrections to the supplied TS-FSRS note

- Current Context7 docs confirm `createEmptyCard()`, `fsrs()`, `repeat()`, `next()`, and the 1-4 rating mapping. `next()`
  returns updated card and log, so the central scheduling contract is current.
- Replace `getTime()` with ISO strings for `timestamptz`; this repository canonicalizes database timestamps as strings
  ([timestamp helpers](https://github.com/MaciekLichon/10x-cards/blob/72febb53332d32e68c776dfecfe4fdfc6fc86058/src/lib/flashcards.ts#L67)).
- Use one configuration decision. The custom example and defaults recommendation conflict. Persist at least a config
  version per review; full effective config is optional if immutable application versions reproduce it.

## Code References

- `context/changes/spaced-repetition-session/ts-fsrs-docs.md:15-99` - scheduler, persistence, and config proposal.
- `context/foundation/roadmap.md:129-157` - S-05 scope, blockers, and readiness.
- `context/foundation/prd.md:40-43,92-106` - safety guardrails and review requirements.
- `supabase/migrations/20260815000000_create_flashcards.sql:1-53` - schema and owner RLS.
- `src/types/database.types.ts:29-64` - generated database surface.
- `src/pages/api/flashcards/collection.ts:78-153` - API, validation, and reconciliation conventions.
- `src/pages/api/flashcards/[id].ts:114-131` - optimistic mutation and ambiguous-result behavior.
- `src/middleware.ts:4-23` - protected dashboard subtree.

## Architecture Insights

The repository treats PostgreSQL/RLS as ownership authority, uses cookie-aware user-scoped Supabase clients, validates
writes at server API boundaries, and reconciles ambiguous results rather than blindly retrying. S-05 should preserve
those patterns. FSRS remains a pure server-side scheduling calculation; PostgreSQL owns durable state-transition
atomicity and ownership enforcement.

`protected React UI -> authenticated Astro API -> server-side ts-fsrs -> transactional Supabase RPC`

## Historical Context (from prior changes)

- `context/changes/user-owned-flashcard-persistence/plan.md:37-94` deliberately deferred scheduling to S-05 and made
  RLS authoritative.
- `context/changes/ai-flashcard-review/plan.md:58-69` established atomic batch creation; accepted cards need scheduling
  defaults/backfill.
- `context/changes/personal-flashcard-collection/plan.md:20-27,55-60` established no public `user_id` and owner-scoped
  reconciliation.
- `context/changes/maintain-flashcard-collection/plan.md:49-55` preserved card identity while deferring scheduling
  semantics. Reset-on-edit is not an existing convention.
- `context/archive/` contains no prior S-05 implementation decision and remained untouched.

## Related Research

- `context/changes/spaced-repetition-session/ts-fsrs-docs.md` - current Context7 implementation reference.
- This document supersedes the earlier external comparison stored at this path; its `ts-fsrs` recommendation is retained
  here and evaluated against the live codebase.

## Open Questions

The product and scheduler questions identified by this research were resolved in the follow-up below. Detailed API,
schema, and UI mechanics remain implementation-planning work rather than unresolved product decisions.

## Follow-up Research 2026-09-01T22:19:05+02:00

The product owner accepted the following decisions for the S-05 planning contract:

1. **Algorithm and ratings:** use FSRS v6 through `ts-fsrs`. Show Again, Hard, Good, and Easy only after the answer is
   revealed. `Rating.Manual` is never exposed or accepted from the user.
2. **Configuration:** use explicit behavioral defaults: `request_retention: 0.9`, `maximum_interval: 36500`,
   `enable_fuzz: false`, `enable_short_term: true`, `learning_steps: ["1m", "10m"]`, and
   `relearning_steps: ["10m"]`. Use the pinned library's default FSRS v6 weights rather than copying them into the
   application. Identify this policy as `fsrs-v6-defaults-v1`.
3. **Session boundary:** capture a server-owned cutoff and select at most 20 cards with `due <= cutoff`, ordered by
   `due, id`. Only those initial card IDs belong to the session. A card may re-enter only after its new FSRS due time.
   The UI may remain active for waits of at most one minute; longer learning/relearning waits finish the session and
   leave the card for a later session.
4. **Editing:** editing front or back preserves FSRS state, due date, and review history. A changed underlying concept
   should be created as a new card. The MVP provides neither automatic change detection nor reset-on-edit.
5. **Deletion:** deleting a flashcard cascades its review logs. Logs are append-only while their parent card exists;
   they are not retained after the user deletes that card.
6. **Dependency and verification:** pin exactly `ts-fsrs` `5.4.2` and commit the lockfile. Persist or otherwise audit
   both library version `5.4.2` and config version `fsrs-v6-defaults-v1`. Do not install the WASI optimizer/binding.
   The implementation must begin with a server-side scheduling smoke test followed by `npx astro sync`,
   `npm run lint`, and `npm run build` against the Cloudflare target.

These decisions resolve the two roadmap blockers and the five integration-policy questions found during codebase
research. `/10x-plan spaced-repetition-session` can now specify the migration, RLS policies, transactional RPC,
idempotent API, React session UI, and verification phases without inventing product behavior.
