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

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
