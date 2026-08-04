---
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
---

## Why this stack

10xCards is a JavaScript/TypeScript web MVP being built after hours in three weeks, with authentication, persistent user-owned flashcards, and AI-assisted generation. The 10x Astro Starter is the vetted default for this product type and language family, providing an opinionated TypeScript stack with Astro, React, Supabase authentication and PostgreSQL, plus a direct Cloudflare deployment path. AI generation will require a manual provider integration because the starter does not bundle one. GitHub Actions will run CI with automatic deployment after merges to main.
