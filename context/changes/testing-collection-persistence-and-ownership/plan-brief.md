# Testing Collection Persistence and Ownership — Plan Brief

> Full plan: `context/changes/testing-collection-persistence-and-ownership/plan.md`
> Research: `context/changes/testing-collection-persistence-and-ownership/research.md`

## What & Why

This change adds automated evidence for three high-impact risks: selected cards disappearing or rejected cards being
saved, unauthorized accounts accessing or changing owner data, and edit/delete operations affecting the wrong card.
The plan preserves current product behavior, including omission of accepted-but-invalid proposals from the save request.

## Starting Point

The repository already has pgTAP schema/policy tests, a local ordinary-client RLS verifier, and component behavior for
stable IDs, optimistic concurrency, and read-only reconciliation. It does not yet have collection API tests, mutation
tests, or focused React tests for visible save/edit/delete failures.

## Desired End State

A local Supabase run proves durable rows, owner isolation, atomic conflicting batches, and target/decoy invariants. Vitest
handler suites prove request and reconciliation contracts, while React suites prove the reviewed set, edit draft, and
undeleted card remain visible through failure and ambiguity paths.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Accepted-invalid proposals | Omit them; save accepted-valid cards | Locks in current workspace behavior without changing product scope | Research / Plan |
| UI failure evidence | Focused React integration | Database/API tests cannot prove visible draft/card retention | Research / Plan |
| Persistence scope | AI batch plus manual creation | Completes the collection persistence cookbook contract | Plan |
| Atomicity evidence | Real local Supabase conflict batch | Exercises the ordinary authenticated boundary, not only mocked handlers | Plan |
| RLS verifier shape | One shared verifier | Reuses setup and avoids local auth rate-limit/setup duplication | Research / Plan |
| Ownership authority | Database RLS | Prevents duplicated and divergent application ownership logic | Research |

## Scope

**In scope:**

- Strengthening `scripts/verify-flashcard-rls.mjs` with snapshots, atomicity, and target/decoy assertions.
- New direct-handler suites for save, collection, and PATCH/DELETE contracts.
- Focused React suites for workspace and collection recovery.
- Updating cookbook §§6.3–6.4 and running local validation gates.

**Out of scope:**

- Production behavior or schema changes.
- Browser automation, CI wiring, hooks, infrastructure, or middleware/cookie journey coverage.
- Strict rejection of unknown manual-create payload keys.

## Architecture / Approach

```text
local Supabase + ordinary clients  →  RLS and durable-state claims
direct Astro handlers + Supabase fake → request/query/reconciliation claims
React + fetch stubs                → visible retention and no-replay claims
```

Each layer has explicit claim boundaries; no mocked handler test is used as evidence of RLS isolation.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Local persistence/ownership | Real RLS, snapshots, atomic conflict proof | Local auth/setup flakiness |
| 2. API contracts | Save, collection, mutation handler coverage | Mock accidentally hides contract behavior |
| 3. React recovery | Visible retention and target identity | Async DOM/dialog setup |
| 4. Gates/cookbook | Full validation and durable testing guidance | Claim drift between tests and guide |

**Prerequisites:** Local Supabase configuration and existing Vitest dependencies.
**Estimated effort:** Approximately 3–4 focused sessions across four phases.

## Open Risks & Assumptions

- The local verifier remains reset-based and should run serially against an isolated stack.
- No real middleware refresh seam is claimed until the later browser phase.
- Accepted-invalid omission remains intentional current behavior.

## Success Criteria (Summary)

- Exact approved durable rows and zero partial rows are proven through local Supabase.
- Unauthorized reads/writes leave owner snapshots unchanged and do not disclose cross-owner existence.
- Failed saves, edits, and deletes retain the user’s actionable state, with ambiguous paths reconciled without mutation replay.
