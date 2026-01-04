// portal/src/lib/createServerClient.ts
// Supabase server client for Next.js 16 (App Router)

import { cookies } from "next/headers";
import {
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from "@supabase/ssr";

/**
 * Create a Supabase client that uses Next.js cookies for auth.
 *
 * Usage (server-only code):
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createServerClient() {
  // In newer Next versions, cookies() is async
  const cookieStore = await cookies();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll might run in a context where response cookies are read-only
            // (e.g. certain Server Components); safe to ignore.
          }
        },
      },
    }
  );

  return supabase;
}

// Allow both default and named import
export default createServerClient;
