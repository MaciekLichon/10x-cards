# Spaced Repetition Session — Plan Brief

> Full plan: `context/changes/spaced-repetition-session/plan.md`
> Research: `context/changes/spaced-repetition-session/research.md`

## What & Why

Build S-05: a protected review session where users study cards due under FSRS v6, reveal answers, rate recall, and keep
progress safely for the next session. This completes the PRD's end-to-end learning flow while enforcing its strongest
guardrails: never lose confirmed progress, show another user's card, or admit a card outside the active schedule.

## Starting Point

The app already has authenticated Astro pages, React islands, owner-scoped flashcards, RLS, and conflict-aware writes.
It has no scheduler dependency, persisted FSRS state, review history, durable session model, review APIs, or study UI.

## Desired End State

Opening `/dashboard/review` creates or resumes a server-owned session of at most 20 due cards. Ratings are calculated
server-side and committed exactly once with their history and session progress; refreshes and stale tabs reconcile
without losing work. Short-term cards may return within one minute, and completion gives a compact progress summary.

## Key Decisions Made

| Decision            | Choice                                             | Why                                                            | Source          |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------- | --------------- |
| Scheduler           | FSRS v6 via exact `ts-fsrs@5.4.2`                  | Uses a maintained algorithm and native four-grade scale        | Research        |
| Policy              | `fsrs-v6-defaults-v1`, default weights             | Reproducible behavior without copying package weights          | Research        |
| Ratings             | Again, Hard, Good, Easy after reveal               | Matches the library and accepted product interaction           | Research        |
| Session selection   | Server cutoff, `due,id`, maximum 20                | Deterministic, bounded, schedule-correct membership            | Research        |
| Session authority   | Durable database session                           | Survives refresh and lets the server verify membership         | Plan            |
| Resume window       | 24 hours from creation                             | Timezone-independent continuity with bounded stale state       | Plan            |
| Scheduling boundary | Server-only privileged RPC caller                  | Prevents clients from manufacturing post-FSRS state            | Plan            |
| Write recovery      | Stable request UUID plus stale reconciliation      | Makes retries exactly-once and multi-tab conflicts recoverable | Research / Plan |
| Short-term flow     | Ready cards first, then countdown up to 60 seconds | Avoids idle time while honoring learning steps                 | Research / Plan |
| Editing/deletion    | Preserve schedule on edit; cascade logs on delete  | Retains learning progress and follows accepted deletion policy | Research        |
| Completion          | Compact rating/deferred summary                    | Gives closure without adding analytics scope                   | Plan            |
| JS verification     | Focused executable scripts, no Vitest              | Covers risky boundaries using repository conventions           | Plan            |

## Scope

**In scope:**

- Pinned scheduler and Cloudflare compatibility gate
- FSRS state/backfill, due index, append-only logs, and 24-hour durable sessions
- RLS plus server-only atomic/idempotent review transaction
- Session and rating APIs with stale/ambiguous recovery
- Protected accessible React review experience and navigation
- pgTAP, ordinary-client integration scripts, failure modes, and manual evidence

**Out of scope:**

- Custom algorithm/weights, user-tunable scheduling, Manual rating, or custom session size
- Reset-on-edit, retained logs after card deletion, reminders, analytics, or detailed history UI
- Vitest/browser automation, mobile app work, or generalized observability infrastructure

## Architecture / Approach

`protected React island → authenticated Astro APIs → server-side ts-fsrs → server-only Supabase client → atomic RPC`

The database stores immutable session membership and review audit records. The API alone selects due cards and computes
FSRS transitions; the transaction locks owner/session/card state and commits the card, log, and session progress
together. The client advances only after confirmed persistence and retries uncertain results with the same request ID.

## Phases at a Glance

| Phase                            | What it delivers                                                 | Key risk                                              |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Scheduler and data foundation | Compatibility proof, schema, sessions, logs, RLS, RPC, types     | Cloudflare bundle or transaction contract fails       |
| 2. Authoritative APIs            | Server-only client, adapters, create/resume and rating endpoints | Privileged boundary or replay mapping leaks authority |
| 3. Review experience             | Reveal/rate flow, queues, countdown, resume, summary             | UI advances before durable confirmation               |
| 4. Resilience evidence           | Database/API scripts and manual acceptance matrix                | Rare lost-response or multi-tab case remains unproved |

**Prerequisites:** Local Supabase access; a server-only service-role key in local and Cloudflare environments; exact
`ts-fsrs@5.4.2` installation must pass the Phase 1 stop/go build gate.
**Estimated effort:** Approximately 4 implementation sessions across 4 gated phases.

## Open Risks & Assumptions

- Exact `ts-fsrs@5.4.2` behavior is documented but not yet proven in this Cloudflare-targeted bundle.
- The privileged client is intentionally narrow; importing its module into client code would be a critical secret leak.
- MVP traffic is unspecified. The plan assumes a 20-row indexed due query is sufficient without caching.
- The roadmap's old Unknowns/backlog prose remains stale because `/10x-plan` is allowed to advance status fields only.

## Success Criteria (Summary)

- Users can resume and complete due-card sessions with reveal-gated Again/Hard/Good/Easy ratings.
- Every confirmed rating updates card state, review history, and session progress atomically and exactly once.
- Cross-account, forged-membership, stale-tab, lost-response, expiry, countdown, and accessibility scenarios pass their
  automated or recorded manual verification.
