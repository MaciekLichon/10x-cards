# Repository Guidelines

This is an Astro 6 application using React 19 islands, TypeScript, Tailwind CSS, Supabase authentication, and the Cloudflare Workers adapter. Product and stack decisions live in `@context/foundation/prd.md` and `@context/foundation/tech-stack.md`.

## Critical Rules

- Never modify `context/archive/`; archived changes are immutable. Open a new change instead.
- Keep secrets out of Git. Copy `@.env.example` to `.env` and `.dev.vars`, then provide `SUPABASE_URL` and `SUPABASE_KEY` locally or through CI/Cloudflare secrets.
- Update `PROTECTED_ROUTES` in `@src/middleware.ts` when a new page requires authentication; do not duplicate route protection inside page components.

## Project Structure

- `src/pages/` contains file-based pages; auth endpoints live in `src/pages/api/auth/`.
- `src/components/` contains shared Astro components and React components. Auth UI is grouped under `src/components/auth/`; reusable primitives live under `src/components/ui/`.
- `src/lib/` holds shared Supabase and configuration helpers, `src/layouts/` contains Astro layouts, and `src/styles/global.css` is the global stylesheet.
- Static files belong in `public/`. Supabase local configuration belongs in `supabase/`. Project context and change artifacts belong in `context/`.

## Build and Development Commands

- `npm run dev` starts the local Astro server.
- `npm run lint` runs the type-aware ESLint configuration; `npm run lint:fix` applies safe fixes.
- `npm run format` formats supported files with Prettier and sorts Tailwind classes.
- `npm run build` creates the Cloudflare-targeted production build; `npm run preview` serves that build locally.

Run `npx astro sync`, `npm run lint`, and `npm run build` before opening a pull request. These are the checks enforced by `@.github/workflows/ci.yml` for `master`.

## Coding Style and Naming

Use two-space indentation, semicolons, double quotes, trailing commas, and a 120-character line width per `@.prettierrc.json`. Name React and Astro components in PascalCase (`SignInForm.tsx`, `Topbar.astro`); use lowercase route filenames (`signin.astro`, `signup.ts`). Import application code through the `@/` alias. Prefix intentionally unused parameters with `_` so ESLint accepts them.

## Testing and Contributions

No automated test runner or coverage threshold is configured. Treat lint and production build as the required validation gate, and add a documented test script before introducing tests.

Recent commits use the course pattern `m1l<lesson> - <scope>` (for example, `m1l3 - bootstrap`). Keep commits focused. Pull requests should summarize behavior changes, list validation commands, note environment or Supabase changes, and include screenshots for visible UI updates.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
