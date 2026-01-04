// portal/src/lib/supabaseServer.ts
// Server-side Supabase client for Next.js 16 (App Router)

import { cookies } from "next/headers";
import {
  createServerClient as createSupabaseServerClient,
} from "@supabase/ssr";

/**
 * Create a Supabase server client wired up to Next.js cookies.
 *
 * Usage (server code only):
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function createServerClient() {
  // In Next.js 16, cookies() is async and returns a Promise<ReadonlyRequestCookies>
  const cookieStore = await cookies();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Supabase only needs getAll / setAll for SSR auth
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) => {
              // This mutates the response cookies so Supabase
              // can keep the auth session in sync.
              cookieStore.set(name, value);
            });
          } catch {
            // If this runs in a context where cookies can't be set
            // (e.g. certain Server Components), it's safe to ignore.
          }
        },
      },
    }
  );

  return supabase;
}

// Allow both:
//   import createServerClient from "@/lib/supabaseServer";
//   import { createServerClient } from "@/lib/supabaseServer";
export default createServerClient;
