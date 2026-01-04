"use server";

import { cookies } from "next/headers";
import {
  createServerClient as createSupabaseServerClient,
  type CookieOptions,
} from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side Supabase client that keeps auth in HTTP-only cookies.
 * Use this only in server components / route handlers.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  const supabase = createSupabaseServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      // @supabase/ssr expects getAll/setAll in the new API
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.error("[supabaseServer] failed to set cookies", error);
        }
      },
    },
  });

  return supabase;
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;
