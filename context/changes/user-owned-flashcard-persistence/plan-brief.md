# User-owned Flashcard Persistence — Plan Brief

> Full plan: `context/changes/user-owned-flashcard-persistence/plan.md`

## What & Why

Create the smallest durable flashcard schema that later AI, collection, and study features can share. PostgreSQL RLS will
make account ownership an invariant, while a repeatable two-user check will prove that one user can never access another
user's cards.

## Starting Point

Supabase authentication and a cookie-aware server client already exist, but the repository has no application tables,
migrations, generated database types, or data-isolation verification. Local migrations are enabled, although the
configured seed file is absent and the README still describes an auth-only database.

## Desired End State

A local reset creates a typed `flashcards` table with validated content, database-managed ownership and timestamps, and
RLS policies for all CRUD operations. Ordinary authenticated clients pass an executable owner-versus-other-user isolation
matrix; anonymous access fails. No hosted database is changed by this implementation cycle.

## Key Decisions Made

| Decision         | Choice                                                 | Why                                                                   |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Card shape       | ID, owner, front, back, timestamps                     | Supports the next slices without pre-deciding AI or repetition fields |
| Ownership        | `user_id` defaults from `auth.uid()` and RLS checks it | Prevents omission, spoofing, and cross-user transfer                  |
| Account deletion | Cascade owned cards                                    | Avoids orphaned personal data                                         |
| Content validity | Trimmed 1–10,000 characters per side                   | Rejects empty and pathological records at every entry point           |
| Timestamps       | Database defaults plus update trigger                  | Keeps lifecycle metadata independent of callers                       |
| Type safety      | Committed generated schema and typed server client     | Gives downstream queries one canonical TypeScript contract            |
| Security proof   | Two real authenticated users plus anonymous client     | Exercises the same anon-key/RLS boundary as the application           |
| Deployment       | Local verification only                                | Keeps hosted schema mutation a separate reviewed action               |

## Scope

**In scope:**

- First flashcard migration, constraints, foreign key, index, timestamp trigger, and CRUD RLS policies
- Empty seed file for reproducible local resets
- Generated Supabase database types and typed existing server client
- Repeatable pgTAP schema checks, database/type commands, and two-user isolation check
- Updated local database documentation and existing Astro validation gates

**Out of scope:**

- UI, API endpoints, collection workflows, AI metadata, and source-text storage
- Spaced-repetition fields or algorithms
- Sharing, imports, search, filtering, and pagination
- Service-role clients, production credentials, or hosted migration application
- General-purpose test framework

## Architecture / Approach

The first migration establishes database invariants and RLS. Local type generation turns that schema into the TypeScript
contract consumed by the existing SSR client. A standalone integration script signs in two disposable local users using
the anon key and asserts owner success, cross-user denial, and anonymous denial before normal Astro checks run.

## Phases at a Glance

| Phase                        | What it delivers                                         | Key risk                                               |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| 1. Database contract and RLS | Minimal table plus database-enforced ownership           | A missing `with check` could allow ownership spoofing  |
| 2. Typed contract and docs   | Generated types, typed client, repeatable workflow       | Generated types could drift from migrations            |
| 3. Isolation proof           | Executable authenticated security matrix and final gates | Privileged verification would produce false confidence |

**Prerequisites:** Local Docker/Supabase stack, `.env` and `.dev.vars` with local URL and anon/publishable key.
**Estimated effort:** About 2–3 focused sessions across three phases.

## Open Risks & Assumptions

- The 10,000-character limit is intentionally conservative and may be revised when S-02 settles generated-card format.
- The verification script assumes local email confirmation remains disabled as configured.
- Local auth URLs use port 3000 while Astro defaults to 4321; this does not block direct client verification but remains a
  pre-existing browser-auth configuration mismatch.
- Applying this migration to a hosted project needs separate approval and rollback review.

## Success Criteria (Summary)

- Owners can create, read, update, and delete their own cards through an authenticated anon-key client.
- Other users and anonymous clients cannot read, mutate, delete, or claim those cards.
- Clean reset, schema lint, deterministic type generation, Astro sync, lint, and production build all succeed.
