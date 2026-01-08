// owner-portal/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


console.log("[supabaseAdmin] anon key prefix:    ", anonKey?.slice(0, 12));
console.log("[supabaseAdmin] service key prefix: ", serviceRoleKey?.slice(0, 12));

if (!supabaseUrl) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL for supabaseAdmin");
}

if (!serviceRoleKey) {
  throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY for supabaseAdmin");
}
// Server-side Supabase client using the service role key.
// DO NOT expose this client to the browser.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
