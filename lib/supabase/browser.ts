import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}

// Matches Supabase quickstart naming
export function createClient() {
  return createSupabaseBrowserClient();
}

