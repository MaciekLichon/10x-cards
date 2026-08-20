# AI Flashcard Generation and Review — Plan Brief

> Full plan: `context/changes/ai-flashcard-review/plan.md`

## What & Why

Build the product's north-star workflow: turn pasted learning material into useful AI-generated flashcards while keeping
the user in control of what is saved. The feature should reduce manual card-writing time without retaining source text or
silently saving weak or unwanted proposals.

## Starting Point

Authentication, a protected dashboard, typed Supabase access, and an RLS-protected `flashcards(front, back)` table already
exist. The dashboard is a placeholder, and there is no AI provider integration, generation API, review UI, or save API.

## Desired End State

A signed-in user pastes 1,000–10,000 characters, receives 1–15 validated question-and-answer proposals in the source
language, edits and selects them, and atomically saves the chosen set. Source text, rejected cards, and raw provider
content remain transient and absent from application storage and logs.

## Key Decisions Made

| Decision         | Choice                                                | Why                                                           |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Card terminology | Question and Answer in UI; map to database front/back | Clear to users without changing the durable schema            |
| Card quality     | One standalone fact/concept; avoid duplicates         | Produces reviewable cards that work without source context    |
| Generation count | Request 5–15; accept 1–4 for sparse material          | Avoids padding weak source material with invented filler      |
| Field limits     | Question 200; answer 500 characters                   | Keeps cards concise while fitting the broader DB contract     |
| Language         | Match the source language                             | Removes an extra control and preserves the learning context   |
| Source limits    | 1,000–10,000 characters                               | Bounds cost/latency while supplying useful context            |
| Persistence      | One atomic insert of accepted cards                   | Prevents partial-save ambiguity and makes retries predictable |
| Provider         | OpenRouter behind a fetch-based server adapter        | Matches infrastructure decisions without adding an SDK        |
| Verification     | Existing static/build gates plus manual matrix        | Honors the decision not to introduce a test runner now        |

## Scope

**In scope:**

- Server-only OpenRouter configuration and adapter
- Authenticated generation with strict input/output validation and safe errors
- Dashboard source input, progress, proposal editing, acceptance, rejection, and undo
- Authenticated atomic save through the existing Supabase/RLS boundary
- Local setup documentation and static/build/manual verification

**Out of scope:**

- Collection management, persisted-card editing, and deletion
- Spaced repetition and study sessions
- Source/proposal history, AI provenance, uploads, URLs, and imports
- Streaming, jobs, retries, caching, rate limiting, and analytics
- Database migrations and a JavaScript test runner

## Architecture / Approach

The protected dashboard hosts a React island with transient workflow state. It calls an authenticated generation endpoint,
which validates source text and delegates to an isolated OpenRouter adapter. After review, a separate endpoint revalidates
accepted cards, maps question/answer to front/back, and performs one RLS-protected multi-row Supabase insert.

## Phases at a Glance

| Phase                                  | What it delivers                                         | Key risk                                  |
| -------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| 1. AI generation foundation            | Config, contracts, provider adapter, generation endpoint | Malformed or slow provider responses      |
| 2. Generation and review interface     | Accessible source and proposal workflow                  | Complex transient state losing user edits |
| 3. Atomic persistence and verification | All-or-nothing owner-safe save and full smoke test       | Duplicate or partial saves after failure  |

**Prerequisites:** F-01 and S-01 remain complete; local Supabase works; an OpenRouter credential and model are supplied in
ignored local environment files.

**Estimated effort:** About 3 focused sessions across three phases, plus manual provider/failure verification.

## Open Risks & Assumptions

- A configuration-selected OpenRouter model supports sufficiently reliable structured JSON and same-language output.
- The 10,000-character source cap can usually meet the 10–15 second target; actual latency must be measured manually.
- Exact normalized-question deduplication catches obvious duplicates but not every semantic overlap.
- No automated application regression suite exists; the manual boundary/failure matrix is therefore load-bearing.
- Rate limiting is deferred, so early access should remain controlled if provider cost abuse becomes plausible.

## Success Criteria (Summary)

- A signed-in user can generate, edit, accept/reject, and atomically save useful same-language cards.
- Every input and proposal boundary is enforced again on the server, and invalid/failing operations save no partial data.
- Source text and generated content do not persist outside the active browser/request, and RLS keeps saved cards owner-only.
