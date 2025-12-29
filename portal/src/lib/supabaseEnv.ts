// portal/src/lib/supabaseEnv.ts

export function getSupabaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  if (!url) {
    throw new Error(
      "Supabase URL missing. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in your env."
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Supabase anon key missing. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in your env."
    );
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Supabase service role key missing. Set SUPABASE_SERVICE_ROLE_KEY in your env."
    );
  }
  return key;
}
