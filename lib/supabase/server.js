// Session-bound client for server components and route handlers: the user's cookies
// are forwarded, so Row Level Security applies to every query.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/mode";

export async function createClient() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          /* called from a server component: the middleware already refreshed the session */
        }
      },
    },
  });
}
