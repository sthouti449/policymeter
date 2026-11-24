import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ConfigError, getEnv } from "@/lib/env";

// Service-role client: full database access, so it lives in server code only
// (CLAUDE.md rule 10). Never import this from a "use client" file.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv().env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new ConfigError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return client;
}
