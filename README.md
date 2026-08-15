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

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
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

The flashcard RLS integration check is added as a separate command:

```bash
npm run db:verify-rls
```

It expects the local stack and the local `SUPABASE_URL` plus anon/publishable `SUPABASE_KEY`. The check uses ordinary
authenticated clients; a service-role or admin client bypasses RLS and is not valid ownership evidence. Reset the local
database before or after verification when you want a clean environment.

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

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

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
