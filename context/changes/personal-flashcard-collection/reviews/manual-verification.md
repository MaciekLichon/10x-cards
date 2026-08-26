# Manual Verification: Personal Flashcard Collection

- **Date:** 2026-08-26
- **Environment:** Local Supabase stack and Astro development environment; current desktop browser required for manual checks
- **Change:** `personal-flashcard-collection`
- **Evidence policy:** Record outcomes only. Do not include credentials, card content, raw payloads, or sensitive screenshots.

## Automated evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Local database reset | Pass | All migrations applied from a clean local database state. |
| Database lint | Pass | No schema errors found. |
| Database pgTAP suite | Pass | 39 tests passed. |
| Generated database type drift | Pass | Generated output matches `src/types/database.types.ts`. |
| Executable RLS verification | Pass | Owner, second-user, and anonymous isolation checks passed through ordinary clients. |
| Astro synchronization | Pass | Route and environment types generated successfully. |
| Type-aware lint | Pass | Zero errors; four pre-existing warnings reported. |
| Cloudflare production build | Pass | Server build completed successfully. |
| Scope and security inspection | Pass | No secrets, service-role access, collection `user_id` payloads, retained card content, or S-04 controls found. |

## Manual scenario matrix

| Scenario | Expected outcome | Result | Notes |
| --- | --- | --- | --- |
| Anonymous protected-page and API access | Collection page redirects and collection API requests are rejected. | Pass | Page redirect, anonymous GET, and anonymous POST confirmed. |
| Two-user isolation | Each authenticated user creates and browses only their own cards across cursor pages. | Pass | User B began empty, saw only its own card, could not reconcile User A's UUID, and User A retained exactly 26 cards across pages. |
| Validation boundaries | Empty and whitespace-only values fail; front 200/back 500 pass; front 201/back 501 fail. | Pass | Client validation and exact-limit save confirmed. |
| Empty, loading, list, and read-retry states | Each state is clear; read failure keeps creation available and Retry recovers. | Pass | Empty, list, injected read failure, available creation form, repeated failure, and recovery confirmed. |
| Normal manual save and authoritative refresh | One card is stored; page one reloads; form clears and collapses; success is announced. | Pass | Exact-limit card saved once; authoritative reload, form reset, success feedback, and creation date confirmed. |
| Ambiguous response reconciliation and safe retry | Stable UUID reconciliation succeeds or exposes a safe retry without duplicate rows. | Pass | Lost-response reconciliation passed twice with one row per intentional submission; confirmed failures preserved content and the same explicit UUID succeeded once after a full clean restart. |
| Stable cursor pagination | More than 20 cards, including equal timestamps, remain newest-first with no gaps or duplicates. | Pass | User A traversed 26 cards; 22 equal-timestamp fixtures used the UUID tie-breaker with no gaps or duplicates. |
| Pagination failure recovery | Existing cards remain visible and a later Load More attempt succeeds. | Pass | Offline Load More preserved 20 cards; restoring network appended the remaining 6 without duplication. |
| Keyboard, focus, live regions, and desktop layout | Controls are keyboard usable, focus recovers meaningfully, announcements work, and layout remains usable. | Pass | Keyboard order, invalid state, focus recovery, visible focus, live-region semantics, wrapping, and desktop grid passed; VoiceOver was not exercised. |
| Existing AI workflow regression | Login, generation, proposal review, and save remain functional. | Pass | Generation, editing, rejection/restoration, selected save, saved-count feedback, and collection visibility confirmed. |

## Sign-off

- **Manual tester:** User-confirmed guided session
- **Manual verification completed:** Yes
- **Overall result:** Pass (VoiceOver not exercised; keyboard and live-region semantics verified)
