# Personal Flashcard Collection — Plan Brief

> Full plan: `context/changes/personal-flashcard-collection/plan.md`

## What & Why

Deliver roadmap slice S-03: authenticated users can manually create a flashcard and browse their entire owner-only
collection. This complements AI generation with a dependable non-AI path and makes saved cards visible before S-04 adds
editing and deletion.

## Starting Point

Authentication, the protected AI workspace, a typed Supabase client, and an RLS-protected `flashcards` table already
exist. AI-reviewed batches can be saved, but there is no collection read path, manual-card API, or collection UI.

## Desired End State

A user navigates to `/dashboard/collection`, loads cards newest-first in bounded pages, and expands a two-field form when
they want to add one manually. Successful saves are retry-safe, refresh the authoritative first page, and show only that
user's cards with their creation dates.

## Key Decisions Made

| Decision           | Choice                                  | Why                                                             |
| ------------------ | --------------------------------------- | --------------------------------------------------------------- |
| Page location      | Separate `/dashboard/collection` route  | Keeps generation and collection workflows focused               |
| Collection loading | Cursor-based Load More                  | Keeps reads bounded and stable as new cards are added           |
| Duplicate content  | Allow duplicates                        | Matches the current schema and preserves intentional repetition |
| Creation UI        | Expandable form above the collection    | Keeps browsing clean without adding another route               |
| Post-save behavior | Reload the first page                   | Makes server state authoritative instead of optimistic          |
| Retry safety       | Client UUID with reconciliation         | Prevents duplicate rows after an interrupted success response   |
| Card display       | Front, back, and creation date          | Shows complete content with lightweight context                 |
| Read failure       | Inline error with Retry                 | Keeps manual creation available while reads recover             |
| Field limits       | Front 200, back 500 characters          | Preserves the concise card contract established by S-02         |
| Authorization      | Request-scoped Supabase client plus RLS | Keeps ownership enforcement at the database boundary            |

## Scope

**In scope:**

- Protected collection page and navigation from the AI workspace
- Owner-only newest-first listing with stable cursor pagination and Load More
- Expandable manual front/back form with accessible validation and feedback
- Retry-safe single-card persistence and authoritative post-save refresh
- Composite collection index, database regression checks, and recorded manual verification

**Out of scope:**

- Persisted-card editing or deletion, which belong to S-04
- Search, filtering, alternate sorting, grouping, or page-number navigation
- Duplicate detection, study behavior, answer reveal, and spaced repetition
- AI/manual provenance, sharing, imports, realtime updates, or a new test runner

## Architecture / Approach

One authenticated API route serves bounded `GET` pages and retry-safe single-card `POST` requests. It uses the existing
cookie-aware Supabase client and RLS, returns public DTOs without `user_id`, and orders on an indexed
`(user_id, created_at DESC, id DESC)` path. A React island owns list, pagination, retry, form, and refresh state on the
dedicated Astro page.

## Phases at a Glance

| Phase                        | What it delivers                                                   | Key risk                                            |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| 1. Data contract and API     | Index, validation, cursor reads, and reconciled manual saves       | Cursor gaps or duplicate saves after ambiguity      |
| 2. Page and workflow         | Navigation, collection states, expandable form, and Load More      | Coupled async states losing form or list state      |
| 3. Verification and evidence | Security, boundary, regression, accessibility, and review evidence | Manual-only browser coverage missing a failure path |

**Prerequisites:** Completed F-01 data/RLS foundation and S-01 authentication; local Supabase must be available for database
and two-user verification.

**Estimated effort:** About 3 focused implementation sessions across three phases, plus manual failure and accessibility
verification.

## Open Risks & Assumptions

- A fixed page size of 20 is sufficient for the MVP browsing experience; search and filtering remain deferred.
- Supabase/PostgREST supports the validated compound keyset filter in the Cloudflare Workers runtime as expected.
- Dates use browser locale formatting; no product-specific timezone or absolute/relative date format is required.
- The repository still has no application test runner, so the API failure matrix and browser evidence are load-bearing.
- A successful save followed by a failed refresh must remain visibly successful and must never trigger another insert.

## Success Criteria (Summary)

- A signed-in user can manually create a valid card and browse every owned card through stable newest-first pages.
- Anonymous and cross-user reads/writes remain denied, and API contracts never expose or accept ownership fields.
- Interrupted saves reconcile without duplicates, errors remain recoverable, and the completed AI workflow still works.
