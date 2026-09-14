We are adding an E2E test for this risk from context/foundation/test-plan.md:
Risk #3 — selected-card failure recovery and durability. A definitive save failure must retain the complete reviewed set,
and a real retry must persist exactly the edited accepted-valid card across collection navigation and reload.

Research anchor:
context/changes/testing-critical-browser-journey/plan.md, Phase 3; tests/e2e/seed.spec.ts.

Business scenario:
From a deterministic mixed proposal set, edit one accepted card, reject one, and invalidate one accepted card. The first
save fails with save_failed and retains all review decisions. The retry sends the identical selected intent through the
real save endpoint. After collection navigation and reload, only the edited accepted-valid card is visible.

Real boundaries (do not mock):
Fixture-owned authentication and cookies, Astro routing and hydration, the retry to /api/flashcards/save, Supabase
persistence, collection GET, navigation, and reload.

Mocked boundaries (mock at network layer):
/api/flashcards/generate returns the deterministic mixed proposal fixture. Exactly the first /api/flashcards/save request
returns a representative 503 save_failed response; subsequent save requests reach the real server.

Write one Playwright test following the canonical seed patterns and project E2E rules. Assert the selected request body,
the retained reviewed state, equality of the failed and retried save intents, and durable collection contents. This test
must catch selection-shaping, failed-save-retention, retry-identity, or reload-durability regressions.
