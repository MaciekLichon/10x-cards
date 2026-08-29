# Manual Verification: Maintain Flashcard Collection

- **Date:** 2026-08-29
- **Environment:** Local Astro development server with resettable local Supabase; current desktop browser
- **Result:** Pass — 18 passed, 0 failed

Record only pass/fail outcomes and concise, non-sensitive observations. Do not include credentials, flashcard content, raw
request/response payloads, user identifiers, or sensitive screenshots.

## Scenario Matrix

| Scenario                                   | Expected evidence                                                                       | Result  | Non-sensitive notes |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------- | ------------------- |
| Front validation at 0/1/200/201 characters | Empty and 201 rejected; 1 and 200 accepted                                              | Pass    | Edit now matches creation: 201 exposes validation and blocks Save; further input is capped. |
| Back validation at 0/1/500/501 characters  | Empty and 501 rejected; 1 and 500 accepted                                              | Pass    | Edit now matches creation: 501 exposes validation and blocks Save; further input is capped. |
| Inline Save and Cancel                     | Save persists trimmed content; Cancel restores the original                             | Pass    | Trimmed edits persisted after refresh; Cancel discarded the unsaved draft. |
| Dirty editor switching                     | Discard confirmation protects the draft                                                 | Pass    | Rejecting discard preserved the draft; accepting discard reset it and reopening did not restore it. |
| Delete dialog accessibility                | Cancel receives initial focus; Tab stays modal; Escape and Cancel restore trigger focus | Pass    | Safe initial focus, modal keyboard containment, Escape, Cancel, and trigger focus restoration passed. |
| Confirmed permanent delete                 | Only the selected owner card is removed                                                 | Pass    | Only the selected card was removed; success persisted after refresh with safe status and focus recovery. |
| Same-user stale edit and delete            | Second session advances the version; stale mutation conflicts without draft loss        | Pass    | Stale edit preserved its draft and newer content; stale delete conflicted without removing the card. |
| Cross-owner isolation                      | A second user cannot observe or mutate the first user's card ID                         | Pass    | Second user could not see, update, or delete the owner's card; responses did not disclose ownership. |
| Definitive update and delete failures      | Safe action-specific errors appear and no write is claimed                              | Pass    | Update and delete failures showed safe action-specific errors; drafts/cards remained and no success was claimed. |
| Lost update response                       | Refresh confirms or rejects the outcome without repeating the update                    | Pass    | Reconciliation confirmed the persisted edit with one PATCH, follow-up collection reads, and no repeated mutation. |
| Lost delete response                       | Refresh confirms or rejects the outcome without repeating the delete                    | Pass    | Reconciliation confirmed persistent removal with one DELETE, follow-up collection reads, and no repeated mutation. |
| Reconciliation after Load More             | Loaded boundary is rebuilt with no gaps, duplicates, or discarded pages                 | Pass    | Later-page lost-response reconciliation preserved loaded coverage, ordering, uniqueness, and Load More behavior. |
| Edit identity preservation                 | Card ID and creation order remain stable while content and version update               | Pass    | Edit preserved ID, creation timestamp, and order while content and updated timestamp changed. |
| Final-card deletion                        | Collection transitions to the empty state and focus reaches its heading                 | Pass    | Final deletion produced the persistent empty state, safe success status, and heading focus recovery. |
| Keyboard and announcements                 | Action order, focus, busy state, polite success, and assertive errors are correct       | Pass    | Keyboard order, validation associations, active-card busy state, safe focus, and live success/error status passed. |
| Authentication and navigation regression   | Sign-up/sign-in/sign-out and protected navigation remain functional                     | Pass    | Protected redirects, account confirmation, sign-in/out, navigation, history, and correct collection restoration passed. |
| S-02 regression                            | AI generation, proposal review/edit, and selected save remain functional                | Pass    | Generation, progress, proposal accept/reject/edit, selected save, and collection persistence passed. |
| S-03 regression                            | Manual creation, initial collection load, and repeated Load More remain functional      | Pass    | Creation persisted and intentionally refreshed to the authoritative first page; repeated Load More remained correct. |

## Completion

- **Overall result:** Pass — 18 passed, 0 failed
- **Verifier:** Human manual verification
- **Exceptions or accepted risks:** None
