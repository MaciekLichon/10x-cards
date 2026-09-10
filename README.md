# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.18.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## AI flashcard configuration

AI generation uses OpenRouter from server code only. Copy `.env.example` to both ignored local files, `.env` and
`.dev.vars`, then set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. The model is configuration-driven and must support the
strict JSON-schema response format required by the application. Never copy keys, source text, or generated card content
into logs, screenshots, commits, or review artifacts.

For Cloudflare, add `OPENROUTER_API_KEY` as an encrypted secret (for example with
`npx wrangler secret put OPENROUTER_API_KEY`) and configure `OPENROUTER_MODEL` as a server-side Workers variable. Do not
commit either value. `DEV_AI_FAILURE_MODE` is local-development-only and must not be added to Wrangler configuration.

To smoke-test locally, sign in, open `/dashboard`, paste 1,000–10,000 characters of non-sensitive single-language text,
generate proposals, edit or reject them, and save the accepted set. The server accepts 1–15 cards, limits questions to
200 characters and answers to 500, and persists only selected cards. Use `provider_timeout`, `provider_rejection`,
`malformed_output`, `save_failure`, or `save_lost_response` as the temporary `DEV_AI_FAILURE_MODE` value to exercise safe
failure and reconciliation paths without recording private content.

Run the final validation gates after the local smoke test:

```bash
npm run db:verify-rls
npx astro sync
npm run lint
npm run build
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run application tests once with Vitest
- `npm run test:watch` - Run application tests in Vitest watch mode
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run db:reset` - Recreate the local database from committed migrations and seed data
- `npm run db:lint` - Lint the local database schema and fail on errors
- `npm run db:test` - Run the pgTAP database contract tests
- `npm run db:types` - Regenerate TypeScript types from the local database schema
- `npm run db:types:check` - Regenerate database types and fail if the committed file changes
- `npm run db:verify-rls` - Verify flashcard ownership through local authenticated clients
- `npm run cf:types` - Regenerate Cloudflare Worker binding types
- `npm run cf:types:check` - Verify generated Worker binding types are current
- `npm run deploy:check` - Run all checks and a Wrangler deployment dry-run

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

3. Copy these two values from the CLI output into both `.env` and `.dev.vars`:

- `SUPABASE_URL`: the value labeled **Project URL** under **APIs**
- `SUPABASE_KEY`: the value labeled **Publishable** under **Authentication Keys**

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<publishable key from CLI output>
```

Do not use the **Secret** authentication key or either key under **Storage**. The application intentionally connects as
an ordinary client so PostgreSQL row-level security remains enforced.

4. Apply all committed migrations and the intentionally empty local seed:

```bash
npm run db:reset
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

The reset creates `public.flashcards` with database-enforced ownership and row-level security. It affects only the local
Supabase stack; applying migrations to a linked or hosted project is a separate reviewed deployment action.

### Database development workflow

After changing a migration, reset and validate the local schema, then regenerate the committed TypeScript contract:

```bash
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:types:check
```

`npm run db:types:check` is deterministic: it compares freshly generated local types with
`src/types/database.types.ts` and fails if they differ. Run it after a clean reset so the local schema matches the
committed migrations.

The flashcard RLS integration check is a separate command:

```bash
npm run db:verify-rls
```

It targets only a resettable local stack, loads `SUPABASE_URL` and `SUPABASE_KEY` from the process, `.env`, or
`.dev.vars`, and refuses non-loopback URLs. The check creates two transient users, prints a `PASS` line for every
positive and negative ownership assertion, and never prints credentials or session tokens. Run `npm run db:reset`
before the check for a known schema and afterward to remove its transient users.

The command must use the local anon/publishable key. A service-role or admin client bypasses RLS and is not valid
ownership evidence. A successful run ends with `Flashcard RLS verification passed`; any violated assertion exits with a
non-zero status.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

Local authentication intentionally requires email confirmation, matching production. The committed Supabase
configuration uses `http://localhost:4321` as the Site URL and allows the exact callback URL
`http://localhost:4321/api/auth/confirm`. Keep `SITE_URL=http://localhost:4321` in `.env` and `.dev.vars`, and run Astro
on its default port so generated confirmation links return to the application.

To verify a new account locally:

1. Start or restart the local stack after configuration changes, then reset it to a known state:

```bash
npx supabase start
npm run db:reset
```

2. Run `npx supabase status` and open the reported Mailpit URL.
3. Start the application with `npm run dev`, register a new email address, and verify that the confirmation-instructions
   page appears.
4. Open the captured message in Mailpit and follow its confirmation link. The application callback exchanges the code,
   stores the session in cookies, and redirects to `/dashboard`.
5. Refresh `/dashboard`, navigate away and back, then sign out. A fresh `/dashboard` request must redirect to
   `/auth/signin`.

Malformed requests, invalid credentials, and missing, invalid, or expired confirmation codes must all show the same
generic authentication error. Provider messages, email addresses, passwords, tokens, and confirmation codes must never
appear in redirect URLs or rendered errors.

### Account-access acceptance matrix

Run the following checks for account-access changes. Use local Supabase and Mailpit first, then repeat the production
happy path with an approved dedicated smoke-test account. Never record smoke-test credentials, tokens, confirmation
codes, or personal email content in the repository.

| Check                                                                     | Local    | Production    |
| ------------------------------------------------------------------------- | -------- | ------------- |
| New registration displays confirmation instructions and delivers an email | Required | Required      |
| A valid confirmation link establishes a session and opens `/dashboard`    | Required | Required      |
| Missing, invalid, or expired confirmation links show the generic error    | Required | As applicable |
| Invalid credentials show the same generic error                           | Required | Required      |
| Valid sign-in opens `/dashboard`                                          | Required | Required      |
| Session survives navigation, refresh, and a fresh request                 | Required | Required      |
| Anonymous `/dashboard` access redirects to `/auth/signin`                 | Required | Required      |
| Sign-out removes access; a new `/dashboard` request redirects to sign-in  | Required | Required      |

Before recording the matrix as complete, run the repository validation and Cloudflare deployment dry run:

```bash
npx astro sync
npm run lint
npm run build
npm run deploy:check
```

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys the `10x-cards` Worker through Cloudflare Workers Builds. A successful push to `main` runs the
validation command and deploys through Cloudflare; GitHub Actions is not part of the CI or deployment path.

Before pushing, run the same validation used by Workers Builds:

```bash
npm run deploy:check
```

The Workers Builds configuration uses:

- Production branch: `main`
- Build command: `npm run deploy:check`
- Deploy command: `npx wrangler deploy`
- Preview URLs and non-production branch builds: disabled

Set `SUPABASE_URL` and `SUPABASE_KEY` as encrypted Worker secrets. Set `SITE_URL` to the production Worker URL as a
non-secret Workers Builds variable so Astro generates canonical URLs correctly.

## CI

Cloudflare Workers Builds is the sole CI and deployment system. Do not add GitHub deployment secrets or a parallel
GitHub Actions deployment workflow.

## License

MIT
