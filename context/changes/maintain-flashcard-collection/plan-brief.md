# Maintain Flashcard Collection — Plan Brief

> Full plan: `context/changes/maintain-flashcard-collection/plan.md`

## What & Why

Deliver roadmap slice S-04: authenticated users can correct or permanently remove existing cards from their collection.
The design protects drafts and newer changes, requires deliberate confirmation before deletion, and preserves the card's
identity for the future review system.

## Starting Point

S-03 already supplies the protected collection page, cursor pagination, manual creation, public DTOs, and owner isolation.
Cards are currently read-only; the API exposes collection `GET` and `POST`, while database RLS and timestamps already
support secure updates and deletes.

## Desired End State

Users edit one card inline with explicit Save and Cancel actions or permanently delete it through an accessible
confirmation dialog. Stale mutations never overwrite newer content, ambiguous results are resolved by rebuilding the
authoritative loaded collection window, and unrelated cards remain usable during a mutation.

## Key Decisions Made

| Decision         | Choice                                      | Why                                                                          |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| Edit interaction | Inline within the card                      | Preserves collection context and matches the existing grid                   |
| Active drafts    | One editor; confirm only dirty discard      | Protects work without maintaining multiple drafts                            |
| Delete safety    | Accessible confirmation dialog              | Addresses the PRD's accidental-loss risk                                     |
| Concurrency      | Reject stale `updatedAt` with `409`         | Prevents silent lost updates and preserves the draft                         |
| Study progress   | Preserve card identity                      | Keeps S-04 independent from the not-yet-designed S-05 model                  |
| Busy state       | Block only the active card                  | Keeps unrelated collection actions responsive                                |
| Ambiguous delete | Refresh the authoritative collection window | Uses the existing read contract rather than repeating a destructive write    |
| Test scope       | Existing DB/RLS gates plus manual matrix    | Fits the repository's current testing strategy without adding infrastructure |

## Scope

**In scope:**

- Version-aware update and permanent-delete API contracts
- Inline edit with validation, Save, Cancel, dirty-discard protection, and conflict handling
- Accessible permanent-delete confirmation and focus recovery
- Per-card mutation state and safe reconciliation through bounded collection refresh
- Owner/RLS regression checks, deterministic failure modes, and manual evidence

**Out of scope:**

- Soft delete, undo, bulk actions, multiple editors, or autosave
- Search/filtering, new pagination behavior, or realtime synchronization
- Study scheduling changes or progress resets
- Schema migrations or a new JavaScript/browser test framework

## Architecture / Approach

The existing collection `GET`/`POST` remains stable. A dynamic resource route adds conditional `PATCH` and `DELETE`
mutations through the request-scoped Supabase client and RLS. `FlashcardCollection` coordinates one active editor and
authoritative list state; individual cards own their draft presentation, and a focused dialog gates deletion.

## Phases at a Glance

| Phase                            | What it delivers                                            | Key risk                                         |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| 1. Versioned mutation contracts  | Validated, owner-scoped PATCH/DELETE with safe errors       | Leaking existence or misclassifying stale writes |
| 2. Inline collection maintenance | Editing, confirmation, focus, and per-card state            | Draft loss or collection-state races             |
| 3. Resilience and evidence       | Failure recovery, RLS regression, and recorded verification | Repeating an ambiguous destructive mutation      |

**Prerequisites:** S-03 collection implementation and a working local Supabase stack.
**Estimated effort:** approximately 2–3 implementation sessions across three phases, plus manual verification.

## Open Risks & Assumptions

- `updatedAt` is treated as a precise mutation precondition; database/server timestamp serialization must remain canonical.
- Ambiguous recovery is bounded to the previously loaded collection window and can require multiple cursor requests.
- Editing preserves future study progress even when content meaning changes; S-05 may later introduce a deliberate reset.
- Missing and cross-owner IDs intentionally share one public response to avoid existence disclosure.

## Success Criteria (Summary)

- Users can safely edit and delete their own cards from the collection using keyboard-accessible controls.
- Stale or ambiguous mutations do not lose drafts, overwrite newer content, repeat destructive writes, or expose other users.
- Database/RLS gates, Astro sync, lint, build, and the documented manual regression matrix all pass.
