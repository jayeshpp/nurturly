import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSupabaseEnv, requireSupabaseEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!hasSupabaseEnv) return response;

  const { url, key } = requireSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Keep request cookies in sync for the remainder of this request.
          try {
            request.cookies.set(name, value);
          } catch {
            // ignore
          }
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refreshes session if needed and writes updated cookies.
  await supabase.auth.getClaims();

  return response;
}

