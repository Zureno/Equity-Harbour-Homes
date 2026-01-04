// owner-portal/lib/currentTenant.ts
// Resolve "who is the logged-in tenant?" using Supabase auth cookies.

import { createServerClient } from "@/lib/supabaseServer";

export type CurrentTenantResult =
  | { status: "no-user" }
  | { status: "no-tenant" }
  | { status: "ok"; tenant: any };

export async function getCurrentTenant(): Promise<CurrentTenantResult> {
  const supabase = await createServerClient();

  // 1) Get the authenticated user from Supabase session cookies
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[currentTenant] No Supabase user in session", userError);
    return { status: "no-user" };
  }

  // 2) Load tenant row linked to this user
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("user_id", user.id) // FK to auth.users.id
    .maybeSingle();

  if (tenantError) {
    console.error("[currentTenant] Failed to load tenant", tenantError);
    return { status: "no-tenant" };
  }

  if (!tenant) {
    console.warn("[currentTenant] No tenant row for user", user.id);
    return { status: "no-tenant" };
  }

  return { status: "ok", tenant };
}
