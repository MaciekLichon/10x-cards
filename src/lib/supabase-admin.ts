import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "astro:env/server";
import type { Database } from "@/types/database.types";

export type AdminClient = SupabaseClient<Database>;

export function createAdminClient(): AdminClient | null {
  const serviceRoleKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL.trim() || !serviceRoleKey?.trim()) return null;

  return createClient<Database>(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
