# Single-Environment Cloudflare Deployment Plan

## Summary

Deploy one production Cloudflare Worker, `10x-cards`, backed by one hosted Supabase project:

- Local development uses Docker-backed Supabase, not production data.
- Production Supabase runs in Central EU (Frankfurt).
- Cloudflare Workers Builds validates and deploys every successful push to `main`.
- GitHub Actions, staging, branch previews, and custom domains are excluded.
- Track execution through the checkboxes in this document.

## Prerequisites

### [x] Phase 0 — Accounts and access

- [x] Confirm access to the GitHub repository and its `main` branch.
- [x] Confirm access to a Cloudflare account with Workers enabled and a configured `workers.dev` subdomain.
- [x] Confirm access to a Supabase organization allowed to create a production project.
- [x] Confirm GitHub permission to install the Cloudflare Workers and Pages GitHub App for this repository.
- [x] Store the Supabase database password in a password manager; never add it to the repository or deployment
  variables.
- [x] Record account/project identifiers in this document without recording credentials:
  - GitHub repository: `MaciekLichon/10x-cards`; production branch: `main`.
  - Cloudflare account ID: `631e47a448422f8f3d322795d4d501ef`.
  - Cloudflare Workers subdomain: `maciek-lichon.workers.dev`; planned Worker name: `10x-cards`.
  - Supabase project reference: `fwjlepwhhyomqoonwgek`; project URL: `https://fwjlepwhhyomqoonwgek.supabase.co`.

### [x] Phase 1 — Local CLI setup

- [x] Install or activate Node.js `22.18.0` from `.nvmrc`, then run `npm ci`.
- [x] Verify `node --version` reports `v22.18.0`.
- [x] Confirm Wrangler CLI is installed and available.
- [x] Verify `npx wrangler --version` uses the repository-pinned Wrangler 4.x version (`4.120.0`).
- [x] Verify `npx supabase --version` uses the repository-pinned Supabase CLI version (`2.98.2`).
- [x] Install and start Docker Desktop with enough resources for the local Supabase stack;
  Supabase recommends approximately 7 GB RAM.
- [x] Authenticate Wrangler interactively with encrypted credential storage (an existing OAuth session was already
  active):
  - `npx wrangler login --use-keyring`
  - `npx wrangler whoami`
- [x] Verify `whoami` shows the intended Cloudflare account ID `631e47a448422f8f3d322795d4d501ef` before any upload.
  Local OAuth is for diagnostics and manual
  recovery only; Workers Builds will use its own Cloudflare-managed token. See
  [Wrangler authentication](https://developers.cloudflare.com/workers/wrangler/commands/general/).
- [x] Do not configure `CLOUDFLARE_API_TOKEN` locally unless OAuth cannot be used; environment tokens take precedence
  over stored OAuth credentials.

### [x] Phase 2 — Local Supabase setup

- [x] Use the existing `supabase/config.toml`; do not rerun `supabase init`.
- [x] Start the local stack with `npx supabase start`.
- [x] Copy `.env.example` to both ignored local files:
  - `.env`
  - `.dev.vars`
- [x] Populate both files with the local API URL and local publishable/anon key printed by Supabase.
- [x] Never place a service-role or secret Supabase key in application environment files.
- [x] Run the Astro development server and test sign-up/sign-in against local Supabase.
- [x] Verify local Mailpit is available; local email confirmation is disabled, so no confirmation email is expected.
- [x] Do not run `supabase login` or `supabase link` against production for this auth-only deployment; no schema migration
  is required. Any future production database link or migration needs a separate reviewed plan. See
  [Supabase CLI workflow](https://supabase.com/docs/guides/local-development/cli/getting-started).

### [ ] Phase 3 — Production Supabase setup

- [x] Create one hosted project named for `10x-cards` in the Central EU (Frankfurt) region. See
  [Supabase regions](https://supabase.com/docs/guides/platform/regions).
- [x] Retrieve from the project's Connect dialog:
  - Project URL → `SUPABASE_URL`.
  - Publishable key, or legacy anon key if publishable keys are unavailable → `SUPABASE_KEY`.
- [x] Do not use the Supabase secret or `service_role` key. Access to future public tables must be protected with Row
  Level Security. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- [x] Enable email/password authentication and email confirmation for production.
- [x] Set the Supabase Auth Site URL to `https://10x-cards.maciek-lichon.workers.dev`.
- [x] Add the same production URL to the allowed redirect URL list; the Site URL is the default destination when the
  application does not supply `redirectTo`. See
  [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [ ] Create a dedicated production smoke-test user; do not reuse a personal administrator account.
- [ ] Verify confirmation-email delivery before enabling Cloudflare automatic deployment.

## Repository and Cloudflare Configuration

### [x] Phase 4 — Simplify deployment configuration

- [x] Configure only the top-level `10x-cards` Worker; do not add Wrangler environments.
- [x] Set the compatibility date to `2026-08-08`, retain `nodejs_compat`, enable persisted observability, and set
  `preview_urls: false`.
- [x] Declare `SUPABASE_URL` and `SUPABASE_KEY` as required Worker secrets.
- [x] Configure Astro with `imageService: "compile"` to prevent unused Cloudflare Images provisioning.
- [x] Set Astro's `site` from the non-secret `SITE_URL` build variable, with a localhost fallback.
- [x] Keep Astro's automatically provisioned `SESSION` KV binding, but do not use it for application data.
- [x] Generate and commit Wrangler types.
- [x] Add scripts:
  - `cf:types` → generate Wrangler types.
  - `cf:types:check` → verify generated types.
  - `deploy:check` → Astro sync, lint, type check, production build, and Wrangler dry-run.
- [x] Remove `.github/workflows/ci.yml` and update documentation so it names Workers Builds as the sole CI/deployment
  system.
- [x] Ensure `.env`, `.dev.vars`, `.env.production`, Wrangler state, and Supabase temporary state remain ignored.

### [x] Phase 5 — Create the Cloudflare Worker safely

- [x] Create a Worker named exactly `10x-cards` in the intended Cloudflare account before connecting GitHub.
- [x] Confirm the resulting hostname is `https://10x-cards.<account-subdomain>.workers.dev`.
- [x] In Worker Settings → Variables and Secrets, add:
  - `SUPABASE_URL` as an encrypted runtime secret.
  - `SUPABASE_KEY` as an encrypted runtime secret.
- [x] List configured secret names and verify spelling without attempting to retrieve their values.
- [x] Confirm the dashboard Worker name exactly matches `wrangler.jsonc`; a mismatch blocks Workers Builds. See
  [Workers Builds setup](https://developers.cloudflare.com/workers/ci-cd/builds/).

## Validation and Automatic Deployment

### [x] Phase 6 — Validate before connecting GitHub

- [x] Run `npm run deploy:check` locally.
- [x] Inspect the generated deployment configuration:
  - Worker name is `10x-cards`.
  - Bindings are limited to `ASSETS`, `SESSION`, and declared secret names.
  - No `IMAGES`, staging, or preview configuration exists.
- [x] Run `npx wrangler whoami` again immediately before any Cloudflare operation.
- [x] Confirm local auth works using local Supabase and the production build completes without requiring production
  credentials.

### [ ] Phase 7 — Configure Workers Builds

- [ ] Install the Cloudflare Workers and Pages GitHub App with "Only select repositories" and grant access only to this
  repository. See
  [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/).
- [ ] Connect the existing `10x-cards` Worker to the repository.
- [ ] Configure:
  - Production branch: `main`.
  - Root directory: repository root.
  - Build command: `npm run deploy:check`.
  - Deploy command: `npx wrangler deploy`.
  - Build variable: `SITE_URL=https://10x-cards.maciek-lichon.workers.dev` as non-secret plain text.
  - Non-production branch builds: disabled.
  - Preview URLs: disabled.
- [ ] Confirm Workers Builds uses `.nvmrc` and the Wrangler version from `package.json`.
- [ ] Review settings before enabling the connection; the first build may deploy the current `main`.
- [ ] Treat enabling the Git connection as explicit approval for the first production deployment.
- [x] Confirm no GitHub Actions workflows or GitHub deployment secrets remain.
- [ ] Verify a successful push to `main` creates one Cloudflare build and one deployment, while a failed build never
  reaches the deploy command.

### [ ] Phase 8 — Production verification and handoff

- [ ] Verify the homepage, static assets, 404 behavior, and anonymous `/dashboard` redirect.
- [ ] Test production sign-up, confirmation, sign-in, protected access, and sign-out.
- [ ] Confirm the test user appears only in production Supabase and no local credentials were deployed.
- [ ] Inspect persisted Workers Logs for runtime errors and accidental credential or personal-data output.
- [ ] Record the final URL, Cloudflare build link, active version ID, resource bindings, and validation results.
- [ ] Document:
  - `npx wrangler deployments list`
  - `npx wrangler versions list`
  - `npx wrangler tail 10x-cards --format json`
  - `npx wrangler rollback <VERSION_ID>`
- [ ] Require explicit human approval before rollback, secret rotation, Supabase schema changes, or destructive
  operations.

## Failure Support

- CLI authentication fails: rerun `npx wrangler login --use-keyring`, then verify the account with `whoami`; do not fall
  back to a broad account API token.
- Local Supabase fails: confirm Docker is running, inspect `npx supabase status`, then stop and restart the local stack
  without using destructive linked-database commands.
- Production auth fails: verify the project URL/key pairing, Site URL, redirect allowlist, email provider, and Supabase
  status before rolling back Worker code.
- Missing Worker secret: add the missing value in the dashboard and retry the same Cloudflare build; do not weaken
  required-secret validation.
- Git integration fails: verify repository permission, Worker-name equality, `main` selection, and reinstall the
  repository-scoped GitHub App if necessary.
- Production regression: roll back to an explicit version ID. Worker rollback does not restore Supabase data or changed
  bindings. See
  [Cloudflare rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Assumptions

- There is one Cloudflare production environment and one hosted production Supabase project.
- Local Docker Supabase is a developer tool, not an additional cloud environment.
- All pushes to `main`, including direct pushes, may deploy after Cloudflare's build checks pass.
- GitHub only supplies source code through the Cloudflare App; GitHub Actions has no role.
- Custom domains, preview deployments, staging, OpenRouter, Cloudflare MCP, and database migrations remain out of scope.
