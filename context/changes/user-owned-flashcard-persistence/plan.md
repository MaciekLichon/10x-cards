# User-owned Flashcard Persistence Implementation Plan

## Overview

Establish the first durable flashcard data contract in Supabase/PostgreSQL. The change provides a minimal typed schema,
database-enforced ownership, and repeatable evidence that authenticated users can operate only on their own cards.

## Current State Analysis

The application already authenticates users through a cookie-aware Supabase server client and resolves the verified user
in middleware. Supabase local development and migrations are enabled, but the repository has no migrations, flashcard
table, generated database types, or data-access verification. The configured seed file is also absent, and the README
still describes the project as auth-only.

The product requires strict account isolation. Because the runtime uses an anon/publishable key rather than a privileged
service-role key, PostgreSQL row-level security can remain the authoritative boundary for all future flashcard features.

## Desired End State

A local database reset creates a `public.flashcards` table whose rows always belong to an authenticated Supabase user.
Owners can create, read, update, and delete their cards; other authenticated users and anonymous clients cannot access
or mutate them. Application code consumes a generated TypeScript schema, and a committed integration check proves the
ownership matrix through normal authenticated Supabase clients.

Completion is verified locally through migration reset/lint, generated-type consistency, the two-user RLS check, Astro
type synchronization, linting, and the Cloudflare-targeted production build. Applying the migration to a hosted project
is a separate reviewed deployment action.

### Key Discoveries:

- `src/lib/supabase.ts:5` is the shared cookie-aware server client and currently has no generated `Database` generic.
- `src/middleware.ts:6` validates the session with `auth.getUser()` and stores the user in `Astro.locals`.
- `supabase/config.toml:53` enables migrations, while `supabase/config.toml:60` points to a missing `seed.sql`.
- `context/foundation/prd.md:114` requires every authenticated user to access only their own flashcards.
- `context/foundation/roadmap.md:66` limits F-01 to persistence and isolation; UI and repetition behavior belong to later slices.

## What We're NOT Doing

- Building flashcard pages, forms, collection views, or API endpoints.
- Defining AI-generation provenance, proposal status, or source-text storage.
- Adding spaced-repetition scheduling, ratings, or progress fields.
- Adding sharing, collaboration, imports, search, filtering, or pagination.
- Introducing service-role credentials or application-side authorization as a substitute for RLS.
- Linking or applying migrations to a hosted Supabase project.
- Adding a general-purpose unit-test framework.

## Implementation Approach

Start with an additive local migration containing the minimal card schema and all ownership policies. Generate a canonical
TypeScript representation of that schema and parameterize the existing server client without adding a premature data
repository. Finally, exercise the policies with two real local users plus an anonymous client through `supabase-js` and
run the repository's existing validation gates.

The table contract is `id uuid`, `user_id uuid`, `front text`, `back text`, `created_at timestamptz`, and
`updated_at timestamptz`. IDs and timestamps are database-generated; `user_id` defaults to `auth.uid()`, is non-null, and
references `auth.users(id)` with cascade deletion. Trimmed front and back content must each contain 1–10,000 characters.
Create an index on `flashcards(user_id)` for the owner-scoped access pattern used by RLS and future collection queries.

## Critical Implementation Details

### State sequencing

Create the schema and policies before generating types or writing the integration check. The isolation check must use
anon-key clients authenticated as ordinary users; a PostgreSQL owner or service-role client bypasses RLS and therefore
cannot prove the product guardrail.

## Phase 1: Database Contract and Row-Level Security

### Overview

Introduce the first migration and make ownership, content validity, timestamps, and account cleanup database invariants.

### Changes Required:

#### 1. Flashcard schema and lifecycle

**File**: `supabase/migrations/<timestamp>_create_flashcards.sql`

**Intent**: Create the minimal durable card representation without pre-committing to AI or repetition-domain fields.

**Contract**: Add `public.flashcards` with database-generated UUID primary key; `user_id` defaulting to `auth.uid()`,
non-null, and referencing `auth.users(id)` with `on delete cascade`; non-empty `front` and `back` text constrained to at
most 10,000 trimmed characters; and database-managed `created_at` and `updated_at` timestamps. Add a reusable trigger
function and update trigger that changes only `updated_at` during row updates.

#### 2. Ownership policies

**File**: `supabase/migrations/<timestamp>_create_flashcards.sql`

**Intent**: Make the database—not individual callers—the authoritative isolation boundary.

**Contract**: Enable RLS and define authenticated-role policies for select, insert, update, and delete using
`auth.uid() = user_id`. Insert and update must include `with check` ownership enforcement so a caller cannot create a row
for another user or transfer ownership. Anonymous access receives no policy.

#### 3. Reproducible reset input

**File**: `supabase/seed.sql`

**Intent**: Satisfy the enabled seed configuration so a clean local database reset is reproducible.

**Contract**: Add a valid, intentionally empty seed file documenting that verification creates transient users and data;
do not commit fixed auth users or production-like content.

#### 4. Database contract test

**File**: `supabase/tests/database/flashcards.test.sql`

**Intent**: Make schema-level guarantees executable without relying on visual inspection or privileged application code.

**Contract**: Add a pgTAP test covering the approved columns, content constraints, ownership foreign key and cascade,
owner index, timestamp trigger behavior, RLS enablement, and expected ownership policies. Keep the authenticated-client
isolation proof in Phase 3 because database-owner tests alone cannot prove PostgREST behavior for ordinary users.

### Success Criteria:

#### Automated Verification:

- Local database reset applies every migration and seed successfully: `npx supabase db reset`
- Local database lint reports no schema or policy errors: `npx supabase db lint --local --fail-on error`
- Database contract tests confirm the table, constraints, foreign key, trigger, RLS, and four ownership policies exist:
  `npx supabase test db`

#### Manual Verification:

- Supabase Studio shows only the six approved flashcard fields and no AI or repetition fields
- Migration review confirms it is additive and does not target a hosted project

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before proceeding.

---

## Phase 2: Typed Application Contract and Local Documentation

### Overview

Expose the schema safely to TypeScript and make migration/type workflows reproducible for future contributors.

### Changes Required:

#### 1. Generated database types

**File**: `src/types/database.types.ts`

**Intent**: Establish one generated source of truth for Supabase table shapes used by later server features.

**Contract**: Commit output from local Supabase type generation, including `public.flashcards` row, insert, update,
relationship, and scalar types. Treat the file as generated output rather than a hand-maintained domain model.

#### 2. Typed server client

**File**: `src/lib/supabase.ts`

**Intent**: Make future table queries schema-aware while preserving the existing cookie and missing-configuration behavior.

**Contract**: Parameterize `createServerClient` with the generated `Database` type. Do not add a service-role client,
repository layer, or flashcard query functions in this foundation change.

#### 3. Database workflow commands

**File**: `package.json`

**Intent**: Provide discoverable, repeatable commands for schema reset, linting, type generation, and RLS verification.

**Contract**: Add narrowly named npm scripts that wrap the locally installed Supabase CLI and the Phase 3 verification
script. Type generation must target `src/types/database.types.ts` deterministically.

#### 4. Local setup documentation

**File**: `README.md`

**Intent**: Replace the stale auth-only database guidance with the migration and verification workflow introduced here.

**Contract**: Document that `npx supabase db reset` applies committed migrations, how to regenerate/check database types,
how to run the RLS verification, and that hosted migration application is not part of ordinary local validation.

### Success Criteria:

#### Automated Verification:

- Database types regenerate without an uncommitted diff
- Astro type synchronization succeeds: `npx astro sync`
- Type-aware lint succeeds: `npm run lint`
- Cloudflare-targeted production build succeeds: `npm run build`

#### Manual Verification:

- README instructions can be followed from a clean local Supabase reset without undocumented database steps
- Generated types expose the six-field flashcard contract and the server client retains cookie-based user sessions

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before proceeding.

---

## Phase 3: Authenticated Isolation Proof and Final Validation

### Overview

Commit executable evidence that RLS permits owner operations and blocks cross-account or anonymous access.

### Changes Required:

#### 1. Two-user RLS integration check

**File**: `scripts/verify-flashcard-rls.mjs`

**Intent**: Test the security contract through the same anon-key Supabase API boundary used by the application.

**Contract**: Create two unique local users with ordinary clients, authenticate each session, and fail with a non-zero
exit code if the ownership matrix is violated. Verify owner insert/select/update/delete; second-user select/update/delete
returns no owner rows; second-user insert with the owner's `user_id` is rejected; and an anonymous client cannot read or
insert cards. Require local `SUPABASE_URL` and anon/publishable `SUPABASE_KEY`; reject service-role usage by documentation
and never print credentials or session tokens.

#### 2. Verification guidance

**File**: `README.md`

**Intent**: Make the proof's prerequisites, expected output, and cleanup model clear.

**Contract**: Explain that verification targets a resettable local stack with email confirmation disabled, creates
transient users, and should be followed or preceded by `db reset` for a clean environment. Document that an admin or
service-role run is invalid evidence because it bypasses RLS.

### Success Criteria:

#### Automated Verification:

- Two-user and anonymous ownership matrix passes through authenticated anon-key clients
- Clean reset followed by type generation and RLS verification succeeds in sequence
- Astro synchronization, lint, and production build all pass
- Working-tree inspection shows no credentials, tokens, or generated local secrets

#### Manual Verification:

- Verification output clearly identifies every positive and negative ownership assertion without exposing secrets
- A deliberate local policy break makes the verification command fail, and restoring the policy makes it pass
- No migration was applied to a hosted Supabase project during implementation

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the manual checks succeeded before closing implementation.

---

## Testing Strategy

### Unit Tests:

- No unit-test framework is introduced; database constraints and policy behavior are validated at their actual boundary.
- Treat pgTAP, generated-type consistency, SQL linting, and the integration script's assertions as automated contract
  checks.

### Integration Tests:

- Owner can insert a card without supplying `user_id`, then select, update, and delete it.
- A second authenticated user cannot observe, mutate, delete, or claim ownership of the first user's card.
- An anonymous client cannot read or insert flashcards.
- Empty, whitespace-only, and over-10,000-character front/back values are rejected.
- Updating a card advances `updated_at` without changing `created_at` or `user_id`.
- Deleting a local auth user cascades to owned cards; verify this during schema-level validation without adding privileged
  credentials to application code.

### Manual Testing Steps:

1. Start or reset the local Supabase stack and inspect the table, relationships, constraints, trigger, and policies.
2. Run the type-generation command twice and confirm the second run produces no diff.
3. Run the RLS verification and review its per-assertion result without inspecting or exposing credentials.
4. Temporarily disable an ownership policy locally, confirm the verification fails, then restore the database with reset.
5. Run `npx astro sync`, `npm run lint`, and `npm run build`.

## Performance Considerations

Add an index beginning with `user_id` because every permitted collection query is owner-scoped and RLS evaluates that
column. Avoid speculative search, scheduling, or metadata indexes until their query patterns exist. The 10,000-character
limits bound individual card payloads; collection pagination belongs to S-03.

## Migration Notes

This is the first additive application-table migration, so no existing flashcard data requires backfill. Validate only
against a resettable local Supabase stack in this change. Applying the migration to a linked or hosted project requires a
separate reviewed deployment action, schema-before-code ordering, and an explicit rollback assessment; Worker rollback
does not revert PostgreSQL schema.

## References

- Change identity: `context/changes/user-owned-flashcard-persistence/change.md`
- Roadmap item F-01: `context/foundation/roadmap.md:66`
- Access-control requirement: `context/foundation/prd.md:114`
- Existing server client: `src/lib/supabase.ts:5`
- Existing user resolution: `src/middleware.ts:6`
- Supabase migration configuration: `supabase/config.toml:53`
- Deployment migration constraints: `context/foundation/infrastructure.md:155`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Contract and Row-Level Security

#### Automated

- [x] 1.1 Local database reset applies every migration and seed successfully: `npx supabase db reset` — 47479a1
- [x] 1.2 Local database lint reports no schema or policy errors: `npx supabase db lint --local --fail-on error` — 47479a1
- [x] 1.3 Database contract tests confirm the table, constraints, foreign key, trigger, RLS, and four ownership policies exist: `npx supabase test db` — 47479a1

#### Manual

- [x] 1.4 Supabase Studio shows only the six approved flashcard fields and no AI or repetition fields — 47479a1
- [x] 1.5 Migration review confirms it is additive and does not target a hosted project — 47479a1

### Phase 2: Typed Application Contract and Local Documentation

#### Automated

- [x] 2.1 Database types regenerate without an uncommitted diff
- [x] 2.2 Astro type synchronization succeeds: `npx astro sync`
- [x] 2.3 Type-aware lint succeeds: `npm run lint`
- [x] 2.4 Cloudflare-targeted production build succeeds: `npm run build`

#### Manual

- [x] 2.5 README instructions can be followed from a clean local Supabase reset without undocumented database steps
- [x] 2.6 Generated types expose the six-field flashcard contract and the server client retains cookie-based user sessions

### Phase 3: Authenticated Isolation Proof and Final Validation

#### Automated

- [ ] 3.1 Two-user and anonymous ownership matrix passes through authenticated anon-key clients
- [ ] 3.2 Clean reset followed by type generation and RLS verification succeeds in sequence
- [ ] 3.3 Astro synchronization, lint, and production build all pass
- [ ] 3.4 Working-tree inspection shows no credentials, tokens, or generated local secrets

#### Manual

- [ ] 3.5 Verification output clearly identifies every positive and negative ownership assertion without exposing secrets
- [ ] 3.6 A deliberate local policy break makes the verification command fail, and restoring the policy makes it pass
- [ ] 3.7 No migration was applied to a hosted Supabase project during implementation
