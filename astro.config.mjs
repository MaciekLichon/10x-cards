// @ts-check
import process from "node:process";

import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  site: process.env.SITE_URL ?? "http://localhost:4321",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare({ imageService: "compile" }),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret" }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret" }),
      OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
      DEV_AI_FAILURE_MODE: envField.enum({
        context: "server",
        access: "secret",
        optional: true,
        values: ["provider_timeout", "provider_rejection", "malformed_output", "save_failure", "save_lost_response"],
      }),
    },
  },
});
