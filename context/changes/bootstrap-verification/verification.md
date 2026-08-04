---
bootstrapped_at: 2026-08-04T22:41:31Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

## Why this stack

10xCards is a JavaScript/TypeScript web MVP being built after hours in three weeks, with authentication, persistent user-owned flashcards, and AI-assisted generation. The 10x Astro Starter is the vetted default for this product type and language family, providing an opinionated TypeScript stack with Astro, React, Supabase authentication and PostgreSQL, plus a direct Cloudflare deployment path. AI generation will require a manual provider integration because the starter does not bundle one. GitHub Actions will run CI with automatic deployment after merges to main.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | unavailable | Starter uses `git clone`, not an npm create-package CLI. |
| GitHub repo | `przeprogramowani/10x-astro-starter`; timestamp not retrieved | unavailable | GitHub CLI (`gh`) was not installed. This check is non-gating. |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 31,392 (including installed dependencies)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted
**Upstream Git history**: deleted before merge

The install added 774 packages and audited 775 packages. npm emitted deprecation warnings for `@babel/plugin-proposal-private-methods@7.18.6` and `node-domexception@1.0.0`.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Exit code**: 1 (findings present; informational)
**Summary**: 1 CRITICAL, 12 HIGH, 7 MODERATE, 2 LOW, 0 INFO
**Direct vs transitive**: direct packages include 0 CRITICAL, 1 HIGH, 2 MODERATE, 0 LOW; remaining findings are transitive. Dependency inventory: 449 production, 316 development, 131 optional, 895 total.

#### CRITICAL findings

- `tar` (transitive, affected `<=7.5.20`, fix available): archive parsing, decompression denial-of-service, infinite-loop, and related advisories. Reached through the direct Supabase CLI dependency.

#### HIGH findings

- `astro` (direct, affected `<=7.0.9`, fix available): reflected XSS, SSRF, spread-attribute XSS, and related advisories.
- `brace-expansion` (transitive, affected `<=1.1.17 || 3.0.0–5.0.8`, fix available): multiple denial-of-service advisories.
- `devalue` (transitive, affected `5.6.3–5.8.0`, fix available): sparse-array deserialization denial of service.
- `fast-uri` (transitive, affected `3.0.0–3.1.4`, fix available): host-confusion advisories.
- `js-yaml` (transitive, affected `4.0.0–4.2.0`, fix available): quadratic CPU denial of service.
- `miniflare` (transitive, fix available): inherited `sharp`, `undici`, and `ws` advisory chain.
- `postcss` (transitive, affected `<=8.5.22`, fix available): source-map path traversal and file disclosure.
- `sharp` (transitive, affected `<0.35.0`, fix available): inherited libvips vulnerabilities.
- `svgo` (transitive, affected `4.0.0–4.0.1`, fix available): incomplete executable-script removal.
- `undici` (transitive, affected `7.0.0–7.28.0`, fix available): TLS validation, request routing, denial-of-service, response desynchronization, and information-disclosure advisories.
- `vite` (transitive, affected `7.0.0–7.3.3`, fix available): Windows path denial bypass and NTLMv2 disclosure advisories.
- `ws` (transitive, affected `8.0.0–8.20.1`, fix available): memory disclosure and exhaustion denial of service.

#### MODERATE findings

- `@astrojs/language-server` (transitive, affected `2.14.0–2.16.10`, fix available): inherited YAML tooling advisory chain.
- `@cloudflare/vite-plugin` (transitive, affected through `1.41.0`, fix available): inherited Miniflare, Wrangler, and WebSocket advisories.
- `supabase` (direct, affected `1.1.6–2.98.2`, fix available): inherited `tar` advisory chain.
- `volar-service-yaml` (transitive, affected `<=0.0.70`, fix available): inherited YAML language-server advisory chain.
- `wrangler` (direct, affected `3.108.0–4.101.0`, fix available): inherited esbuild and Miniflare advisories.
- `yaml` (transitive, affected `2.0.0–2.8.2`, fix available): stack overflow through deeply nested collections.
- `yaml-language-server` (transitive, affected versions reported by npm, fix available): inherited `yaml` advisory chain.

#### LOW / INFO findings

- `@babel/core` (transitive, affected `<=7.29.0`, fix available): arbitrary file read through a source-map comment.
- `esbuild` (transitive, affected `0.27.3–0.28.0`, fix available): Windows development-server arbitrary file read.
- INFO: none.

The complete machine-readable audit output for this run was inspected from `/tmp/10x-cards-npm-audit.json`; URLs and exact advisory chains are available by rerunning `npm audit --json`. Bootstrapper intentionally did not run `npm audit fix`.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | true |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
