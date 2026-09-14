We are adding an E2E test for this risk from context/foundation/test-plan.md:
Risk #4: Anonymous users or other accounts access someone else's cards.

Research anchor:
context/changes/testing-critical-browser-journey/plan.md Phase 4 — anonymous page/API denial and rendered owner/other-user collection isolation.

Business scenario (one observable behavior that must stay true after this flow):
An anonymous browser is redirected from the protected collection page and receives the stable unauthenticated API
envelope. After an owner creates a uniquely identifiable card, a separately authenticated user's loaded collection does
not render it, while the owner's reloaded collection still renders its exact front and back.

Real boundaries (do not mock — the risk hides here):
Authentication cookies, Astro middleware and routing, the collection API, React hydration, Supabase persistence, and RLS
read isolation.

Mocked boundaries (mock at network layer):
None. This flow does not call an external provider.

Write one Playwright test following tests/e2e/seed.spec.ts patterns and the E2E rules in AGENTS.md. Use an explicit empty
storage state for the anonymous context and the fixture's explicit state for the second user. Wait for a positive real
collection response or loaded UI state before asserting absence. Assert the business outcome that would fail if Risk #4
materialized. Do not issue or claim cross-owner mutations.

Regression caught: a missing anonymous guard, broken session separation, or owner-unscoped collection read that discloses
the owner's card or makes it disappear from the owner's durable collection.
