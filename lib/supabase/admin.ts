import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv, requireSupabaseServiceRoleKey } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceRoleKey = requireSupabaseServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

