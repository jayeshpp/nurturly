import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const { url, key } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components, Next's cookies are read-only.
        // In Route Handlers, this will succeed and persist auth changes.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            (cookieStore as any).set(name, value, options);
          });
        } catch {
          // no-op
        }
      },
    },
  });
}

// Matches Supabase quickstart naming
export async function createClient() {
  return createSupabaseServerClient();
}

