// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// These come from owner-portal/.env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for Supabase");
}
if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for Supabase");
}

/**
 * Admin client:
 * - Uses the service_role key
 * - Bypasses RLS (so ONLY use this in server-side code)
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
