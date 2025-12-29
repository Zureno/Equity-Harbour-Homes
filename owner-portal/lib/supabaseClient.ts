// supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL for supabase client");
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing env NEXT_PUBLIC_SUPABASE_ANON_KEY for supabase client"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
