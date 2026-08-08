---
project: 10x-cards
researched_at: 2026-08-07
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 with React 19 islands
  runtime: Cloudflare Workers
---

## Recommendation

**Deploy on Cloudflare Workers.**

Workers is the only candidate that matches the repository without a runtime migration: the application already uses
`@astrojs/cloudflare`, server output, Wrangler 4, and a Workers entry point. It also matches the developer's existing
Cloudflare experience, while Supabase and OpenRouter satisfy the stated preference for external managed services. The
single-region audience reduces the value of global execution, so latency between Workers and the Supabase region must be
measured rather than assumed to be fast.

Astro 6 no longer supports Cloudflare Pages through the Cloudflare adapter. This decision therefore targets **Workers**,
not Pages, and uses the Workers deployment workflow documented by
[Astro](https://v6.docs.astro.build/en/guides/integrations-guide/cloudflare/) and
[Cloudflare](https://developers.cloudflare.com/workers/wrangler/commands/workers/).

## Platform Comparison

Pass = 2, Partial = 1, Fail = 0. The total measures agent operability; the final ranking also accounts for compatibility
with this repository and the interview constraints.

| Platform           | CLI-first | Managed/serverless | Agent-readable docs | Stable deploy API | MCP/integration | Total | Project fit                                                      |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | --------------- | ----: | ---------------------------------------------------------------- |
| Cloudflare Workers | Pass      | Pass               | Pass                | Pass              | Pass            |    10 | Exact adapter/runtime match                                      |
| Netlify            | Pass      | Pass               | Pass                | Pass              | Pass            |    10 | Requires Netlify adapter migration                               |
| Vercel             | Pass      | Pass               | Pass                | Pass              | Partial         |     9 | Requires Vercel adapter migration; MCP beta                      |
| Railway            | Pass      | Pass               | Pass                | Partial           | Pass            |     9 | Requires Node adapter; rollback is not a first-class CLI command |
| Render             | Partial   | Pass               | Pass                | Partial           | Pass            |     8 | Requires Node adapter; free service cold starts                  |
| Fly.io             | Pass      | Partial            | Pass                | Pass              | Partial         |     8 | Requires Node adapter and container operations                   |

**Cloudflare Workers.** The Wrangler CLI covers deployment, versions, rollback, secrets, and logs. The platform is fully
managed, its documentation is available in agent-readable formats, and Cloudflare offers official remote MCP servers.
At 10,000–100,000 monthly requests, the Free plan can remain at $0 if daily request and CPU limits are respected; the
Paid plan starts at $5/month. Static asset requests are free and unlimited. See
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and
[Cloudflare MCP servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/).

**Netlify.** Netlify has a complete CLI, deterministic draft/production deploys, readable documentation, and an official
MCP server. Its credit-based Free plan can cover low request volume, although production deploys, bandwidth, and compute
consume credits and can pause all projects when exhausted. The project would need to replace `@astrojs/cloudflare` with
`@astrojs/netlify` and audit all runtime-specific code. See
[Astro's Netlify adapter guide](https://docs.astro.build/en/guides/integrations-guide/netlify/) and
[Netlify credit pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

**Vercel.** Vercel provides mature preview deployments, a comprehensive CLI, managed functions, and configurable regions
that could be placed near Supabase. It requires `@astrojs/vercel` for this server-rendered application, and its official
MCP integration was explicitly beta when checked. See [Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro)
and [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp).

**Railway.** Railway offers a smooth source-deploy CLI, project-scoped tokens, managed services, and official agent
integrations. Running this application there requires replacing the Cloudflare adapter with `@astrojs/node` in standalone
mode. Costs are resource-based rather than request-based, and rollback uses the dashboard or GraphQL API instead of a
dedicated CLI command. See [Railway deployment](https://docs.railway.com/cli/deploying) and
[Railway pricing](https://docs.railway.com/pricing/plans).

**Render.** Render supports managed Node web services, readable Markdown documentation, WebSockets, and an official MCP
server. It also requires a Node-adapter migration. Free services sleep after inactivity and may take about a minute to
wake, which is a poor fit for authenticated MVP flows; rollback is available through the dashboard or REST API rather
than a documented CLI subcommand. See [Render web services](https://render.com/docs/web-services) and
[Render's free-service limitations](https://render.com/docs/free).

**Fly.io.** Fly.io has a strong CLI and supports persistent processes, WebSockets, and regional Machines, but this project
would need the Astro Node adapter plus container and `fly.toml` configuration. There is no free tier for new accounts, and
its first-party flyctl MCP commands were experimental when checked. Those costs and operational responsibilities add no
clear value for the current stateless workload. See [Astro on Fly.io](https://docs.astro.build/en/guides/deploy/flyio/),
[Fly.io pricing](https://fly.io/docs/about/pricing/), and [flyctl MCP](https://fly.io/docs/flyctl/mcp/).

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Workers won because it combines a perfect agent-operability score with zero adapter migration, existing developer
familiarity, and a low-cost path for MVP traffic. The existing `wrangler.jsonc` already targets
`@astrojs/cloudflare/entrypoints/server`, enables Node compatibility, serves the built assets, and enables observability.

#### 2. Netlify

Netlify tied on the five general criteria and offers an excellent managed experience. It ranked second because changing
the adapter and auditing Cloudflare-specific runtime behavior creates work and risk without satisfying a stated need.

#### 3. Vercel

Vercel provides an equally polished application-deployment workflow and potentially useful regional function placement.
It ranked third because it also requires an adapter migration, the team has no stated Vercel familiarity, and the official
MCP integration remains beta.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. Workers execute globally while Supabase is regional. A request handled far from the database can accumulate latency
   across authentication and sequential queries, erasing the perceived edge advantage.
2. The Free plan allows 10 ms of CPU time per invocation. Although network waiting is excluded, parsing, validating, and
   transforming large OpenRouter responses can outgrow this allowance.
3. Cloudflare-specific bindings, runtime context, compatibility dates, and adapter behavior can spread through the code.
   A later move to a conventional Node host would require an application-level portability audit.
4. `wrangler rollback` restores Worker code, not Supabase migrations, external service state, or deleted and modified
   bindings. Treating it as a full-system rollback can prolong an incident.
5. Astro 6 materially changed the Cloudflare workflow: Pages support is gone and named environments are selected during
   the build. Astro 5 tutorials can generate incorrect deployment procedures.

### Pre-Mortem — How This Could Fail

Six months after launch, the team discovers that the apparently ideal Cloudflare fit concealed a data-locality problem.
Workers execute near users, but every authenticated request still crosses the network to one Supabase region. The
application gradually adds several sequential database calls per page, making routine navigation slower despite its edge
deployment. AI generation also grows beyond simple proxying: responses are parsed, validated, retried, and transformed
until some requests exceed the Free plan's CPU allowance or encounter runtime limits.

Meanwhile, the team follows an older Astro deployment example and assumes `wrangler deploy --env staging` selects the
complete runtime environment after a generic build. Astro 6 actually selects that environment during the build, so a
production artifact receives incorrect configuration. A hurried rollback restores Worker code but leaves an incompatible
Supabase migration in place, extending the outage.

Finally, Cloudflare-specific environment access and bindings spread through application code. When the team considers
moving compute closer to Supabase, the supposedly simple hosting change becomes a runtime migration. None of these issues
is individually fatal, but together they erase the original speed and simplicity advantage.

### Unknown Unknowns

- Astro 6 uses Cloudflare's Vite integration, so `npm run dev` already runs with Workers runtime fidelity. A separate
  `wrangler dev` command should not be introduced as the primary application development loop.
- For a named environment, build with `CLOUDFLARE_ENV=staging npm run build` before deploying it. Adding only
  `wrangler deploy --env staging` after a generic build is an obsolete Astro 5 pattern.
- The adapter's default `cloudflare-binding` image service can create or use a Cloudflare Images binding. Set
  `imageService: "compile"` if all image transformations should happen during the build.
- Prerendering runs in workerd by default. A Node-only prerender dependency requires the adapter's
  `prerenderEnvironment: "node"` option.
- Workers rollback retains up to 100 recent versions and does not restore Supabase state or binding changes. See
  [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Operational Story

- **Preview deploys**: Connect the GitHub repository through Workers Builds. Configure non-production branches to run
  `npm ci && npm run build` and preview deployment through `npx wrangler versions upload`; each uploaded version receives
  a version preview URL. Do not expose previews containing real user data publicly—protect them with Cloudflare Access or
  use isolated Supabase credentials. Fork pull requests must not receive production secrets. See
  [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
- **Secrets**: Store `SUPABASE_URL`, `SUPABASE_KEY`, and the future OpenRouter credential as Workers secrets, using
  `npx wrangler secret put <NAME>`. Keep local values in ignored `.dev.vars`/`.env` files and CI credentials in GitHub
  Secrets. Developers and agents may reference secret names but must not print or retrieve plaintext values. Secret
  rotation requires a human-approved replacement followed by application verification; never commit values to
  `wrangler.jsonc`.
- **Rollback**: Inspect versions, then run `npx wrangler rollback <VERSION_ID>`; omitting the ID selects the previous
  upload and still changes production immediately. Expect code traffic to revert quickly, but separately repair or roll
  forward Supabase migrations and verify bindings because neither is reverted with the Worker.
- **Approval**: An agent may run builds, linting, preview uploads, deployment inspection, and read-only log commands.
  Publishing or rolling back production, rotating primary secrets, changing production bindings, and applying destructive
  Supabase operations require explicit human approval.
- **Logs**: Stream live runtime logs with `npx wrangler tail 10x-astro-starter --format json`. Use persisted Workers Logs
  for historical inspection; the Free plan includes 200,000 events per day with three-day retention, while Paid includes
  20 million events per month with seven-day retention. See
  [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Risk Register

| Risk                                                           | Source           | Likelihood | Impact | Mitigation                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross-region calls to Supabase create slow authenticated pages | Devil's advocate | M          | H      | Locate the Supabase project deliberately, measure p50/p95 server timings from representative users, avoid sequential queries, and batch database work.       |
| OpenRouter response processing exceeds Free-plan CPU limits    | Devil's advocate | M          | M      | Stream or minimally transform responses, measure CPU time in Workers Logs, cap input/output sizes, and move to Paid before limits affect users.              |
| Cloudflare runtime coupling makes migration expensive          | Devil's advocate | M          | M      | Keep business logic Web-API-compatible, isolate bindings behind `src/lib` adapters, and avoid direct runtime access in components and domain logic.          |
| Code rollback leaves Supabase schema incompatible              | Pre-mortem       | M          | H      | Use backward-compatible expand-and-contract migrations, deploy schema before dependent code, and document a separate database recovery or roll-forward plan. |
| Incorrect environment is embedded during the Astro build       | Pre-mortem       | M          | H      | Build each environment with `CLOUDFLARE_ENV` set, define explicit CI jobs, and verify the target configuration on its preview URL before promotion.          |
| Old Pages or Astro 5 guidance produces invalid commands        | Unknown unknowns | M          | M      | Treat Astro 6 and adapter 13+ docs as authoritative; keep all project documentation explicit that the target is Workers, not Pages.                          |
| Runtime image binding appears unexpectedly                     | Unknown unknowns | L          | M      | Decide whether runtime image processing is needed; otherwise configure `imageService: "compile"` and verify the generated bindings.                          |
| Preview deployments expose production data or credentials      | Research finding | M          | H      | Use isolated preview secrets and Supabase environments, block secrets on fork PRs, and protect previews with Cloudflare Access.                              |
| Worker rollback cannot restore changed bindings                | Research finding | L          | H      | Version binding configuration in Git, review binding changes separately, and maintain a manual restoration checklist.                                        |
| Free-tier limits or pricing change                             | Research finding | M          | M      | Add usage alerts, review Cloudflare billing monthly during MVP validation, and keep a tested Netlify migration outline as contingency.                       |

## Getting Started

1. Authenticate the repository-pinned CLI with `npx wrangler login`, then confirm the intended Cloudflare account with
   `npx wrangler whoami`. Account setup and authentication are manual gates; do not place API tokens in Git.
2. Add production secrets interactively with `npx wrangler secret put SUPABASE_URL` and
   `npx wrangler secret put SUPABASE_KEY`. Add the OpenRouter key under its final application variable name when that
   integration is implemented.
3. Run the repository validation gate: `npx astro sync`, `npm run lint`, and `npm run build`. Astro 6 already uses the
   Cloudflare runtime during development and build, so no separate platform-native dev command is required.
4. Create a preview without changing production by running `npx wrangler versions upload`, then test authentication,
   Supabase row isolation, OpenRouter request behavior, static assets, and the custom 404 response at the preview URL.
5. After explicit human approval, deploy with `npx wrangler deploy`. Verify the production URL, inspect JSON logs with
   `npx wrangler tail 10x-astro-starter --format json`, and retain the prior version ID for rapid code rollback.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
