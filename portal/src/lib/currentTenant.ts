// portal/src/lib/currentTenant.ts
import createServerClient from "@/lib/createServerClient";

export type CurrentTenantResult =
  | { status: "no-user" }
  | { status: "no-tenant" }
  | { status: "ok"; tenant: any };

export async function getCurrentTenant(): Promise<CurrentTenantResult> {
  const supabase = await createServerClient();

  // 1) authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("No Supabase user in session", userError);
    return { status: "no-user" };
  }

  // 2) tenant row linked to auth user
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tenantError || !tenant) {
    console.error("Failed to load tenant", tenantError);
    return { status: "no-tenant" };
  }

  return { status: "ok", tenant };
}
