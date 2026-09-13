import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export interface E2EEnvironment {
  supabaseUrl: string;
  supabaseKey: string;
  supabaseServiceRoleKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
}

export function loadE2EEnvFiles(): void {
  for (const envFile of [".env", ".dev.vars"]) {
    if (existsSync(envFile)) loadEnvFile(envFile);
  }
}

function requireEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured for the local E2E suite.`);
  return value;
}

export function requireE2EEnvironment(): E2EEnvironment {
  loadE2EEnvFiles();

  const supabaseUrl = requireEnvironmentValue("SUPABASE_URL");
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL for the local E2E suite.");
  }

  const hostname = configuredUrl.hostname.replace(/^\[|\]$/g, "");
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error("Refusing to provision E2E users against a non-loopback Supabase URL.");
  }

  return {
    supabaseUrl,
    supabaseKey: requireEnvironmentValue("SUPABASE_KEY"),
    supabaseServiceRoleKey: requireEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
    openRouterApiKey: requireEnvironmentValue("OPENROUTER_API_KEY"),
    openRouterModel: requireEnvironmentValue("OPENROUTER_MODEL"),
  };
}
