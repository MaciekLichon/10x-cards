# Account Access Implementation Plan

## Overview

Verify and harden the existing email-and-password account flow so a user can create and confirm an account, sign in,
enter `/dashboard`, retain a server-readable session, and sign out. The work keeps the starter's Astro and Supabase SSR
architecture while closing correctness, security, configuration, and accessibility gaps required by FR-001 and FR-002.

## Current State Analysis

The application already provides sign-up, sign-in, sign-out, cookie-backed Supabase sessions, middleware authentication,
and a protected dashboard. The baseline is functional, but it relies on client-only validation, exposes raw provider
errors through query parameters, sends a successful sign-in to the public homepage, and guesses confirmation behavior
from the Astro development flag. Local Supabase also disables confirmation and uses port 3000 while Astro runs on 4321.

### Key Discoveries

- `src/pages/api/auth/signup.ts:4` and `src/pages/api/auth/signin.ts:4` cast untrusted form values and forward raw
  Supabase errors rather than enforcing a server-side request contract.
- `src/pages/api/auth/signin.ts:19` redirects authenticated users to `/`, although the roadmap outcome requires entry to
  the protected application.
- `src/pages/auth/confirm-email.astro:3` treats every development run as auto-confirmed; this does not represent the
  configured authentication mode.
- `src/middleware.ts:4` centralizes protected routes as required by repository policy, but its prefix matcher also
  matches unrelated names such as `/dashboard-public`.
- `src/components/auth/FormField.tsx:42` and `src/components/auth/ServerError.tsx:10` provide visual errors without the
  agreed semantic invalid, description, required, and alert contracts.
- `supabase/config.toml:150` targets port 3000 and `supabase/config.toml:214` disables email confirmation, while the app
  default is `http://localhost:4321` and production already requires confirmation.
- Supabase's SSR/PKCE confirmation flow returns an authorization code that must be exchanged server-side before the
  application can persist the authenticated session in cookies.
- There is no application test runner. Repository validation currently consists of Astro sync/check, ESLint, build, and
  Cloudflare dry-run checks in `package.json:5`.

## Desired End State

A new user submits a server-validated email/password registration, receives a confirmation message in both local and
production environments, follows the confirmation link through an application callback, and arrives at the protected
dashboard with a valid cookie-backed session. A returning user signs in and is sent directly to `/dashboard`.
Unauthenticated dashboard access remains blocked, sign-out removes access, failures reveal only one stable generic
message, and form errors expose the agreed semantic accessibility attributes.

## What We're NOT Doing

- Password reset, password change, OAuth, magic links, MFA, anonymous access, profiles, roles, or account deletion
- Preserving form values after a server redirect or adding first-invalid-field focus management
- Redirecting users back to arbitrary pre-login destinations; successful sign-in always targets `/dashboard`
- Redirecting already authenticated users away from sign-in or sign-up pages
- Adding an application test runner, unit tests, integration tests, or browser automation
- Changing flashcard tables, RLS policies, production database schema, or the centralized protection model
- Adding resend-confirmation UI, custom SMTP, rate-limit controls, CAPTCHA, or production observability work

## Implementation Approach

Retain the request-scoped `@supabase/ssr` client and standard server POST endpoints. Introduce one shared validation and
public-error contract for both endpoints, explicitly start confirmation with an application callback URL, and exchange
the returned PKCE code in that callback so Supabase can write the session cookies. Align local Supabase configuration
with production confirmation behavior, then tighten middleware and form semantics without expanding the product scope.

## Critical Implementation Details

### Confirmation lifecycle

The sign-up endpoint must derive the confirmation callback from the current application origin and pass it as
`emailRedirectTo`. The callback must exchange a present authorization code with the request-scoped Supabase client before
redirecting to `/dashboard`; missing, expired, or invalid codes must return the user to sign-in with the same generic
public failure contract. The local Site URL and redirect allowlist must include the actual Astro origin and callback.

### Public error boundary

Provider error text must remain server-side. Sign-up and sign-in must catch failures from parsing form data and redirect
through the same generic public error contract. Query parameters may carry only a stable application-owned error code
that the page maps to one generic user message; passwords, email addresses, tokens, authorization codes, and provider
messages must never be placed in redirect URLs or logs.

## Phase 1: Harden the Server Authentication Contract

### Overview

Make sign-up, confirmation, and sign-in correct at the server boundary and consistent across local and production
confirmation-enabled environments.

### Changes Required

#### 1. Shared authentication input and error contract

**File**: `src/lib/auth.ts` (new)

**Intent**: Centralize runtime parsing for email/password form submissions and the single public authentication failure
contract so the endpoints cannot drift or expose provider messages.

**Contract**: Accept unknown form values, return either trimmed email plus a password meeting the current six-character
minimum or a validation failure, and expose one stable public error code/message mapping. The helper must not log or
return credentials.

#### 2. Sign-up endpoint

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Validate direct POST requests, require confirmation, and send confirmation links back through the
application's server callback.

**Contract**: Reject malformed input through the generic public error route; call `signUp` with email, password, and an
origin-derived `emailRedirectTo` targeting `/api/auth/confirm`; route every accepted registration to
`/auth/confirm-email`; never expose Supabase error text.

#### 3. Confirmation callback

**File**: `src/pages/api/auth/confirm.ts` (new)

**Intent**: Complete the Supabase SSR/PKCE flow and establish the cookie-backed session after the user confirms their
address.

**Contract**: Handle GET requests, accept only the `code` query parameter required for `exchangeCodeForSession`, exchange
it using the request-scoped client, redirect success to `/dashboard`, and redirect all missing/configuration/exchange
failures to sign-in with the generic application error code.

#### 4. Sign-in and sign-out endpoints

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`

**Intent**: Apply the same validation and disclosure boundary to sign-in, make protected access the successful outcome,
and avoid silently treating a failed sign-out as success.

**Contract**: Sign-in validates the request, maps all failures to the generic application error, and redirects success
to `/dashboard`. Sign-out redirects success to `/` and redirects a provider failure to sign-in with the same generic
error; unconfigured Supabase is a failure in both endpoints.

#### 5. Confirmation-enabled local configuration

**Files**: `supabase/config.toml`, `.env.example`

**Intent**: Make local behavior match production and ensure generated confirmation links target the running Astro app.

**Contract**: Enable email confirmations, use the port-4321 application origin as the local Site URL, allow the exact
confirmation callback URL, and keep `SITE_URL=http://localhost:4321` as the documented application origin. No hosted
Supabase setting is mutated by implementation code.

### Success Criteria

#### Automated Verification

- Astro types and generated modules synchronize successfully: `npx astro sync`
- Type-aware linting passes after the server-contract changes: `npm run lint`
- The Cloudflare-targeted production build succeeds: `npm run build`

#### Manual Verification

- A malformed direct sign-up or sign-in POST is rejected without a runtime exception or disclosure of provider details
- A local registration sends a confirmation email to Mailpit and displays confirmation instructions
- Following a valid local confirmation link establishes the session and opens `/dashboard`
- Missing, expired, or invalid confirmation codes return to sign-in with one generic authentication error
- Valid sign-in opens `/dashboard`, invalid credentials show the same generic error, and sign-out removes protected access

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that the local Supabase and Mailpit checks succeeded before proceeding.

---

## Phase 2: Complete the Protected-Access Experience

### Overview

Tighten the centralized route boundary and add the agreed semantic accessibility support without redesigning the visual
authentication experience.

### Changes Required

#### 1. Protected-route matching

**File**: `src/middleware.ts`

**Intent**: Preserve centralized protection while preventing similarly named public routes from being captured by a
broad string prefix.

**Contract**: A protected entry matches its exact pathname or descendants separated by `/`; `/dashboard` and
`/dashboard/...` are protected, while `/dashboard-public` is not. Middleware continues to call `getUser()` and populate
`Astro.locals.user` on every request.

#### 2. Stable page-level server errors

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`,
`src/components/auth/ServerError.tsx`

**Intent**: Convert application-owned error codes into one generic message and expose the message as an assistive
technology announcement.

**Contract**: Pages recognize only the stable application error code and never render arbitrary query text.
`ServerError` uses alert/live-region semantics while retaining the established visual treatment.

#### 3. Semantic form validation

**Files**: `src/components/auth/FormField.tsx`, `src/components/auth/SignInForm.tsx`,
`src/components/auth/SignUpForm.tsx`

**Intent**: Make required fields and validation failures programmatically discoverable without adding the declined focus
management behavior.

**Contract**: Required controls expose `required`; invalid controls expose `aria-invalid`; each field error or hint has a
stable ID connected through `aria-describedby`; existing client validation and password-toggle behavior remain intact.

#### 4. Confirmation instructions

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Remove the development-environment guess and always describe the confirmation-required flow selected for
this product.

**Contract**: The page consistently tells users to check their email and follow the confirmation link. It does not infer
authentication configuration from `import.meta.env.DEV`.

### Success Criteria

#### Automated Verification

- Astro types and generated modules synchronize successfully: `npx astro sync`
- Type-aware linting passes after middleware and form changes: `npm run lint`
- The Cloudflare-targeted production build succeeds: `npm run build`

#### Manual Verification

- Anonymous `/dashboard` and `/dashboard/...` requests redirect to sign-in while `/dashboard-public` is not matched by the dashboard rule
- Required and invalid fields expose their state and associated descriptions to browser accessibility tooling
- Server authentication errors are announced as alerts and arbitrary `?error=` text is never rendered
- The confirmation page always describes the email-confirmation flow in local and production builds

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation
that route-boundary and accessibility checks succeeded before proceeding.

---

## Phase 3: Verify and Document Account Access

### Overview

Make the confirmation-enabled workflow reproducible for contributors and collect local plus production evidence that
the roadmap outcome is met.

### Changes Required

#### 1. Authentication documentation

**File**: `README.md`

**Intent**: Replace obsolete local auto-confirm guidance with the actual Mailpit and callback workflow, and document the
manual acceptance matrix expected for account-access changes.

**Contract**: Document the 4321 redirect configuration, confirmation-enabled local setup, Mailpit confirmation steps,
generic-error expectation, successful dashboard destination, and existing repository validation commands. Preserve the
ordinary publishable/anon-key rule and Cloudflare Workers Builds deployment model.

#### 2. Local acceptance evidence

**File**: `context/changes/account-access/plan.md`

**Intent**: Use this plan's Progress section as the canonical record that the selected manual matrix and existing gates
were completed.

**Contract**: Verify new registration, confirmation, invalid confirmation, invalid credentials, valid sign-in, session
persistence after navigation and a fresh request, anonymous protection, and sign-out against local Supabase and Mailpit.
No automated test framework is introduced.

#### 3. Production smoke evidence

**File**: `context/changes/account-access/plan.md`

**Intent**: Confirm that deployed Supabase email delivery, redirect allowlist, Worker secrets, callback cookies, and
protected navigation behave like the local contract.

**Contract**: With an approved dedicated smoke-test account, repeat the registration, email confirmation, dashboard,
session persistence, sign-out, and anonymous-dashboard checks against production. Do not record credentials, tokens,
confirmation codes, or personal email content in the repository.

### Success Criteria

#### Automated Verification

- The complete repository validation and Cloudflare dry run pass: `npm run deploy:check`
- The change contains no raw provider-error rendering or development-only confirmation branch: `! rg 'error\.message|isAutoConfirmed' src/pages src/components`

#### Manual Verification

- The complete local confirmation-enabled account-access matrix passes using Supabase and Mailpit
- The production happy path passes with a dedicated smoke-test account and no secrets or personal data recorded
- After sign-out in both environments, a new `/dashboard` request redirects to sign-in

**Implementation Note**: Completion requires explicit human confirmation of production smoke testing; do not mark the
phase complete from historical deployment evidence alone.

---

## Testing Strategy

### Automated Checks

- Run `npx astro sync`, `npm run lint`, and `npm run build` after each implementation phase.
- Run `npm run deploy:check` as the final repository and Cloudflare dry-run gate.
- Use the final targeted `rg` check to catch the two obsolete disclosure/configuration patterns.
- Do not add a unit, integration, or browser test runner in this change.

### Manual Testing Steps

1. Start local Supabase with confirmation enabled, reset it to a known state, and obtain the Mailpit URL from
   `npx supabase status`.
2. Submit malformed direct POSTs and confirm they fail safely without provider details or credentials in URLs.
3. Register a new address, confirm that the instructions page appears, then open the captured Mailpit link.
4. Verify the callback establishes a session and redirects to `/dashboard`; refresh and navigate away/back to prove
   session persistence.
5. Exercise missing, invalid, and expired callback codes and invalid credentials; confirm the same generic error appears.
6. Verify exact protected-route matching, semantic field/error attributes, sign-out, and denial after sign-out.
7. Repeat registration, delivered-email confirmation, dashboard, persistence, sign-out, and anonymous-dashboard checks
   against production with the dedicated smoke-test account.

## Performance Considerations

Authentication remains synchronous and request-scoped, with one Supabase auth operation per endpoint and the existing
authoritative `getUser()` middleware check per request. This slice adds no caching, background work, or client-side auth
state. Confirmation and sign-in latency remain dependent on Supabase and email delivery; no performance target beyond a
responsive pending/redirect experience is introduced.

## Migration Notes

No database migration is required. Local `supabase/config.toml` changes take effect after restarting/resetting the local
stack. Production already has email confirmation enabled, but its Site URL and allowed callback URL must be verified
before smoke testing; any dashboard change is a manual environment action, not a repository-side schema change. Rollback
consists of reverting the application/config changes and redeploying the previous Worker version; it does not delete
accounts created during verification.

## References

- Product requirements: `context/foundation/prd.md:61`
- Roadmap slice: `context/foundation/roadmap.md:81`
- Existing server client: `src/lib/supabase.ts:6`
- Existing middleware boundary: `src/middleware.ts:4`
- Existing deployment evidence: `context/changes/deployment/deployment-plan.md:146`
- Supabase password authentication: https://supabase.com/docs/guides/auth/passwords
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase code exchange: https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Harden the Server Authentication Contract

#### Automated

- [x] 1.1 Astro types and generated modules synchronize successfully: `npx astro sync` — 65f2bb3
- [x] 1.2 Type-aware linting passes after the server-contract changes: `npm run lint` — 65f2bb3
- [x] 1.3 The Cloudflare-targeted production build succeeds: `npm run build` — 65f2bb3

#### Manual

- [x] 1.4 A malformed direct sign-up or sign-in POST is rejected without a runtime exception or disclosure of provider details — 65f2bb3
- [x] 1.5 A local registration sends a confirmation email to Mailpit and displays confirmation instructions — 65f2bb3
- [x] 1.6 Following a valid local confirmation link establishes the session and opens `/dashboard` — 65f2bb3
- [x] 1.7 Missing, expired, or invalid confirmation codes return to sign-in with one generic authentication error — 65f2bb3
- [x] 1.8 Valid sign-in opens `/dashboard`, invalid credentials show the same generic error, and sign-out removes protected access — 65f2bb3

### Phase 2: Complete the Protected-Access Experience

#### Automated

- [x] 2.1 Astro types and generated modules synchronize successfully: `npx astro sync`
- [x] 2.2 Type-aware linting passes after middleware and form changes: `npm run lint`
- [x] 2.3 The Cloudflare-targeted production build succeeds: `npm run build`

#### Manual

- [x] 2.4 Anonymous `/dashboard` and `/dashboard/...` requests redirect to sign-in while `/dashboard-public` is not matched by the dashboard rule
- [x] 2.5 Required and invalid fields expose their state and associated descriptions to browser accessibility tooling
- [x] 2.6 Server authentication errors are announced as alerts and arbitrary `?error=` text is never rendered
- [x] 2.7 The confirmation page always describes the email-confirmation flow in local and production builds

### Phase 3: Verify and Document Account Access

#### Automated

- [ ] 3.1 The complete repository validation and Cloudflare dry run pass: `npm run deploy:check`
- [ ] 3.2 The change contains no raw provider-error rendering or development-only confirmation branch: `! rg 'error\.message|isAutoConfirmed' src/pages src/components`

#### Manual

- [ ] 3.3 The complete local confirmation-enabled account-access matrix passes using Supabase and Mailpit
- [ ] 3.4 The production happy path passes with a dedicated smoke-test account and no secrets or personal data recorded
- [ ] 3.5 After sign-out in both environments, a new `/dashboard` request redirects to sign-in
