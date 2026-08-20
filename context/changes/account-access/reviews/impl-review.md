<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Account Access Implementation Plan

- **Plan**: context/changes/account-access/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-08-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Auth POST endpoints lack an explicit same-origin boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:5
- **Detail**: The sign-in, sign-up, and sign-out POST handlers proceed directly to parsing and Supabase calls without validating `Origin`/`Referer` or a CSRF token. Browser SameSite behavior reduces exploitability, but an explicit application boundary is absent, leaving login-CSRF/session-swapping and cross-site registration abuse possible in clients that accept the resulting cookies. This risk predates the change, but these handlers were substantially rewritten as part of the planned server-boundary hardening.
- **Fix**: Add a shared same-origin request validator and apply it before parsing or calling Supabase in all three POST handlers.
  - Strength: Centralizes one consistent policy and closes the cross-site request class at the server boundary.
  - Tradeoff: Requires choosing how to handle missing `Origin` headers and whether the trusted origin comes from `SITE_URL` or the request URL.
  - Confidence: MED — the missing check is directly observable, but practical exploitability depends on deployed cookie and browser behavior.
  - Blind spot: The deployed Supabase cookie attributes and any upstream Cloudflare request protections were not inspected.
- **Decision**: FIXED — added a strict shared same-origin validator to sign-in, sign-up, and sign-out; Astro sync, lint, and build pass. Manual curl verification returned 302 for the matching origin and 403 for both a foreign and missing origin.

### F2 — Roadmap status is stale relative to the completed change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:36
- **Detail**: The current uncommitted roadmap edit marks S-01 `in-progress` at lines 36 and 91, while `context/changes/account-access/change.md` is already `implemented` and every plan progress item is checked. This leaves project workflow metadata internally inconsistent. The edit was preserved as user-owned work and was not modified during review.
- **Fix**: Update both S-01 roadmap status entries to `done` and refresh the roadmap `updated` date when intentionally closing the slice.
- **Decision**: FIXED — updated both S-01 roadmap status entries from `in-progress` to `done`.

## Verification Evidence

- `npx astro sync` — PASS (exit 0)
- `npm run lint` — PASS (exit 0; 2 warnings in generated `worker-configuration.d.ts`)
- `npm run build` — PASS (exit 0; existing generated CSS minifier warning)
- `npm run deploy:check` — PASS (exit 0 after rerunning outside the sandbox so the Cloudflare inspector could bind a local port)
- `! rg 'error\.message|isAutoConfirmed' src/pages src/components` — PASS (exit 0)
- Manual progress items 1.4–1.8, 2.4–2.7, and 3.3–3.5 are checked and tied to phase commits in the canonical Progress section. The review did not repeat external Mailpit or production smoke testing.
