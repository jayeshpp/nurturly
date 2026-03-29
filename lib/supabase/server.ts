import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env";

type CookieStoreWithSet = {
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

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
            (cookieStore as unknown as CookieStoreWithSet).set(
              name,
              value,
              options as unknown as Record<string, unknown>
            );
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

