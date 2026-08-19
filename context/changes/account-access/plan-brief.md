# Account Access — Plan Brief

> Full plan: `context/changes/account-access/plan.md`

## What & Why

Verify and harden the existing email/password account flow so users can create and confirm an account, sign in, enter the
protected dashboard, retain their session, and sign out. This closes FR-001, FR-002, and roadmap slice S-01 without
redesigning authentication or delaying the first AI workflow.

## Starting Point

The starter already has forms, Supabase endpoints, cookie-backed sessions, middleware, and `/dashboard` protection. The
remaining gaps are server validation, safe errors, a correct SSR confirmation callback, direct protected navigation,
precise route matching, semantic form errors, aligned local configuration, and repeatable verification.

## Desired End State

Registration always requires email confirmation locally and in production. A confirmation link establishes a server
session and opens `/dashboard`; normal sign-in also opens `/dashboard`, while invalid requests receive one generic error.
Sign-out removes protected access, and the complete flow is proven locally and with a production smoke test.

## Key Decisions Made

| Decision            | Choice                            | Why                                                                |
| ------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Scope               | Verify and harden existing auth   | Close material gaps without rebuilding the starter                 |
| Sign-in destination | Always `/dashboard`               | Directly satisfies the protected-access outcome                    |
| Email verification  | Required in every environment     | Keeps local and production behavior consistent                     |
| Error disclosure    | One generic public message        | Prevents provider details from entering URLs or UI                 |
| Accessibility       | Semantic attributes and alerts    | Covers core assistive-technology behavior without focus management |
| Automated testing   | No test runner in S-01            | Preserve scope and rely on existing gates plus manual auth checks  |
| Acceptance evidence | Local matrix and production smoke | Proves both application behavior and hosted configuration          |

## Scope

**In scope:**

- Server-side sign-up/sign-in validation and a stable generic error contract
- Confirmation-enabled local Supabase configuration and correct callback URLs
- SSR/PKCE confirmation code exchange and cookie-backed session creation
- Successful sign-in and confirmation redirect to `/dashboard`
- Precise centralized protected-route matching
- Required, invalid, described-by, alert, and live-region semantics
- Documentation, existing automated gates, local Mailpit matrix, and production smoke test

**Out of scope:**

- Password recovery, OAuth, MFA, profiles, roles, account deletion, or resend UI
- Arbitrary return-to redirects, field focus management, or preserving form values after redirect
- Unit, integration, browser, or E2E test infrastructure
- Database migrations, hosted schema changes, custom SMTP, CAPTCHA, or monitoring expansion

## Architecture / Approach

Standard Astro POST endpoints continue to use the request-scoped `@supabase/ssr` client. Shared validation and a single
public error code protect the boundary; sign-up supplies an application callback URL, the callback exchanges the PKCE
authorization code into cookies, and middleware remains the only route-protection layer.

## Phases at a Glance

| Phase              | What it delivers                                                  | Key risk                                                            |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Server contract | Validation, generic errors, confirmation callback, aligned config | Incorrect callback configuration could prevent session creation     |
| 2. Access UX       | Precise protection, dashboard navigation, semantic form errors    | Accessibility contracts could drift between shared fields and pages |
| 3. Verification    | Updated docs, final gates, local matrix, production smoke         | Hosted email or redirect settings may differ from the repository    |

**Prerequisites:** Local Docker Supabase, Mailpit, valid `.env` and `.dev.vars`, and access to the production smoke-test
account and inbox.

**Estimated effort:** About 2–3 focused sessions across three phases.

## Open Risks & Assumptions

- Production email confirmation is enabled, but the exact allowed callback URL still needs verification before smoke testing.
- Supabase's default hosted email service is suitable for smoke testing but is rate-limited and not a production SMTP strategy.
- No automated application tests are added by explicit decision, so the manual matrix is part of the completion contract.
- Production verification creates an account that must be managed outside this repository without recording credentials.

## Success Criteria (Summary)

- A user confirms a newly created account and reaches `/dashboard` with a persistent server-readable session.
- Valid sign-in opens `/dashboard`; malformed or invalid requests expose only one generic message.
- Anonymous access and post-sign-out access to protected routes fail locally and in production.
