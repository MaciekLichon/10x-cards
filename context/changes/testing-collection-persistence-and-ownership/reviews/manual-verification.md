# Manual Verification: Testing Collection Persistence and Ownership

- **Date:** 2026-09-13
- **Environment:** Local Astro development environment
- **Result:** Pass — 4 passed, 0 failed

Record only non-sensitive outcomes. Do not include credentials, flashcard content, user identifiers, raw payloads, or
screenshots containing user data.

## Scenario Matrix

| Scenario                 | Expected outcome                                          | Result | Non-sensitive notes                                                                                 |
| ------------------------ | --------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Save failure             | Failed work remains visible and retry messaging is clear  | Pass   | The failed save remained visible and recoverable; no success was claimed.                           |
| Edit failure             | The exact draft remains associated with the target card   | Pass   | The target retained its edit draft and displayed the failure; the decoy card was unaffected.        |
| Delete failure           | The target remains visible and the error is target-scoped | Pass   | The target remained present with delete-failure feedback; the decoy card was unaffected.            |
| Retry and reconciliation | Recovery messaging matches the confirmed collection state | Pass   | Retry/reconciliation feedback remained visible until the collection settled to its confirmed state. |

## Completion

- **Overall result:** Pass — 4 passed, 0 failed
- **Verifier:** Human manual verification
- **Exceptions or accepted risks:** None
