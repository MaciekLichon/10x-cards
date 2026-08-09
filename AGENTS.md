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

## 10xDevs AI Toolkit - Module 2, Lesson 1

Move from sprint-zero setup to project orchestration with the **roadmap chain**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` is the lesson focus. `/10x-new` is intentionally introduced in Module 2, Lesson 2, when a selected roadmap item becomes an implementation change folder.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Roadmap (lesson focus)** | |
| `/10x-roadmap` | You have `context/foundation/prd.md` and a scaffolded project baseline, and you need a vertical-first MVP roadmap. The skill reads the PRD, inspects the code baseline, uses available foundation docs such as `tech-stack.md`, `infrastructure.md`, and `deploy-plan.md`, then writes `context/foundation/roadmap.md`. Use it BEFORE creating per-change folders or implementation plans. |
| **Re-run upstream if needed** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Bundled from Module 1 so foundation contracts can be fixed before roadmap sequencing. If roadmap generation exposes a PRD gap, repair the PRD before pretending the backlog is ready. |

### How the chain hands off

- `/10x-roadmap` bridges product and implementation. It does not choose frameworks, design schemas, or write a per-change implementation plan.
- The output is `context/foundation/roadmap.md`: ordered milestones, vertical slices, bounded foundations, dependencies, unknowns, risk, and backlog handoff fields.
- Roadmap items should receive stable human-readable identifiers in backlog tools. The actual `context/changes/<change-id>/` folder is created in Lesson 2 with `/10x-new`.

### Roadmap boundaries

- Default to vertical slices: user-visible outcomes that cross UI, data, business logic, and integrations.
- Horizontal work is allowed only as a bounded enabler that names the downstream vertical milestone it unlocks.
- Avoid orphan horizontal work such as "build the whole database", "build all API endpoints", or "design the whole UI" before the first user-visible flow.
- Roadmap is not a calendar estimate. Do not invent dates, story points, or sprint velocity unless the user explicitly asks for a separate planning artifact.

### Foundation paths used by this lesson

- `context/foundation/prd.md` - input
- `context/foundation/tech-stack.md` - optional input
- `context/foundation/infrastructure.md` - optional input
- `context/deployment/deploy-plan.md` - optional input
- `context/foundation/roadmap.md` - output
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
