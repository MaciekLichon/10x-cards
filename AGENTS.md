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

## 10xDevs AI Toolkit - Module 2, Lesson 5

Scale the single-change cycle into parallel work with **worktrees, goal-directed delegation, and multi-session orchestration**:

```
worktree per change -> /goal or your AI coding assistant -p -> PR -> review -> merge
```

The lesson focus is safe throughput: isolated contexts, choosing the right execution mode, and capping parallelism at review capacity.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code isolation** | |
| `git worktree add` | You need a separate working directory for a parallel change. One change per worktree, one fresh agent context per worktree. |
| **Complex changes** | |
| `/10x-implement <change-id> phase <n>` | The change has multiple phases, needs manual gates, or benefits from interactive decision-making during execution. |
| **Simple changes** | |
| `/goal` | You have a clear, bounded task and want goal-directed delegation. The agent works autonomously toward the stated goal with a stop condition. |
| `your AI coding assistant -p` | You want headless execution for a well-defined task. The Ralph Wiggum loop (run, check, retry) is the universal autonomous pattern. |
| **Multi-session orchestration** | |
| Superset / Conductor / Antigravity / VS Code Agent View | You are running multiple agent sessions in parallel and need visibility, coordination, or session management across them. |

### Parallel work rules

- One change per worktree or isolated workspace. One fresh agent context per change.
- Choose interactive `/10x-implement` for complex changes, `/goal` or `your AI coding assistant -p` for simple ones.
- Parallelism is capped by review capacity. More agents without review means more unreviewed code, not higher throughput.
- The quality pain from faster shipping is intentional — it bridges into Module 3 testing gates.

### Lesson boundaries

- Do not reteach interactive `/10x-implement` or `/10x-impl-review`; those are Lessons 2 and 3.
- Do not introduce testing strategy here. The quality pain is the motivation for Module 3.
- Worktrees are a mechanism for isolation, not the topic of a full git tutorial.

### Paths used by this lesson

- `context/changes/<change-id>/` - active change folder
- `context/changes/<change-id>/plan.md` - implementation input for any execution mode

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
