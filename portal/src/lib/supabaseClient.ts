// portal/src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseAnonKey } from "./supabaseEnv";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
