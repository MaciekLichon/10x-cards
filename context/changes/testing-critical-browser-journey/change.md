---
change_id: testing-critical-browser-journey
title: Test the critical browser journey
status: implementing
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Critical browser journey".
Risks covered: #1 invalid AI output, #3 selected-card persistence, and #4 ownership isolation. Test types planned: minimal e2e.
Risk response intent:

- #1: Prove invalid output produces recoverable browser-visible failure while valid cards remain usable; challenge the assumption that HTTP success means valid cards.
- #3: Prove only selected edits persist and failed saves remain visible across the real browser boundary; challenge the assumption that success feedback proves durability.
- #4: Prove denied access leaves owner data private and intact across authentication, cookies, middleware, UI, and persistence; challenge the assumption that login proves ownership.
  After creating the folder, follow the downstream continuation rule.
