# Spaced Repetition Session — Manual Verification

Date: 2026-09-05  
Environment: local Astro development server and reset local Supabase stack  
Browser / viewport: full-screen laptop viewport  
Tester: user-led manual verification

Do not add credentials, tokens, service-role keys, or flashcard content to this record. Mark each row `Pass` or `Fail`
and add a short, non-sensitive observation. Resolve every failure before confirming phase 4.

| Scenario                                                                                        | Result  | Evidence / observation |
| ----------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| Due cards appear in `due, id` order and initial membership is capped at 20                      | Pass    | UI confirmed the 20-card initial session cap; deterministic ordering is covered by the automated verifier. |
| Answer is hidden until reveal; rating controls are unavailable beforehand                       | Pass    | Answer and rating controls appeared only after reveal; focus moved to the rating controls. |
| Again, Hard, Good, and Easy each persist and update the summary                                 | Pass    | Each rating confirmed persistence before advancing, and the completion summary reflected the rating counts. |
| Other ready cards are shown before a short-term waiting card                                    | Pass    | After an Again rating, the other ready card appeared before the short-term repeat. |
| A wait of at most 60 seconds shows a countdown and refreshes authoritatively                    | Pass    | Countdown decreased automatically and the waiting card appeared after authoritative refresh. |
| A longer learning or relearning wait is deferred                                                | Pass    | A roughly 10-minute Good interval completed the session instead of starting a long countdown, with a deferred-card notice. |
| Empty and completed states show the expected summary and navigation                             | Pass    | Completion totals and deferred notice were correct; empty-state and completion navigation worked. |
| Refresh before 24-hour expiry resumes the same session                                          | Pass    | Refresh preserved the remaining card and did not restore already confirmed progress. |
| Refresh after 24-hour expiry creates a new cutoff and session                                   | Pass    | An aged active session became expired and refresh acquired a new active session with the remaining due card. |
| `rating_lost_response` retries the same request and applies exactly one review                  | Pass    | The ambiguous response retained the rating intent; retry reconciled it and advanced progress exactly once. |
| `rating_stale_transition` / two-tab conflict reconciles without losing confirmed progress       | Pass    | A stale rating in the second window restored the latest session and did not duplicate progress. |
| Deleting a card removes its session membership and review log                                   | Pass    | Deleting a reviewed card preserved the remaining session; deleting the last active member then creating a due card produced a fresh 1-card session instead of an empty-session loop. Database verification confirms membership and log cascades. |
| Keyboard-only reveal/rating flow restores useful focus and prevents duplicate input while busy  | Pass    | Reveal moved focus directly to Again; rapid repeated activation produced one confirmation and countdown; after the wait, one Tab reached Reveal answer from the restored card focus. |
| Loading, countdown, error, empty, and completion states are acceptable at desktop widths        | Pass    | At a full-screen laptop viewport, countdown and completion states were readable and unclipped; the forced session-failure panel and Retry control were clear and correctly aligned. |
| A second account cannot read or mutate the first account's cards, sessions, membership, or logs | Pass    | A second account saw neither the first account's recognizable collection card nor its review progress. The ordinary-client verifier confirms cross-account read and mutation denial for the underlying review data. |

## Development failure modes

Set one value in `.dev.vars`, restart `npm run dev`, exercise the scenario, then remove the value and restart:

- `DEV_REVIEW_FAILURE_MODE=session_failure` — session GET fails before acquisition.
- `DEV_REVIEW_FAILURE_MODE=rating_failure` — rating POST fails before the transaction.
- `DEV_REVIEW_FAILURE_MODE=rating_lost_response` — the first rating commits but returns an ambiguous response; retrying
  must reuse the same request ID and return the stored canonical result.
- `DEV_REVIEW_FAILURE_MODE=rating_stale_transition` — a new rating returns a stale conflict and restores the latest
  authoritative session.

## Final result

- Overall: Pass
- Unresolved failures: None
- Notes: Two defects found during execution were corrected and retested: exhausted sessions after membership deletion
  now close during acquisition, and revealing an answer now moves keyboard focus directly to Again.
