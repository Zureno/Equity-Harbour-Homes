// portal/src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
} from "./supabaseEnv";

const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getSupabaseServiceRoleKey();

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
