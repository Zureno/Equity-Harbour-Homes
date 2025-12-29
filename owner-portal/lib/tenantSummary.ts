// owner-portal/lib/tenantSummary.ts
import { supabaseAdmin } from "./supabaseAdmin";

export type TenantSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  unit_label: string | null;
  current_balance: number;
  last_payment_at: string | null;
};

export async function getTenantsWithSummaries(): Promise<TenantSummary[]> {
  // 1) Load tenants
  const { data: tenants, error: tenantsError } = await supabaseAdmin
    .from("tenants")
    .select("id, full_name, email, unit_label");

  if (tenantsError) {
    console.error("[getTenantsWithSummaries] tenants error:", tenantsError);
    throw tenantsError;
  }

  const tenantIds = tenants?.map((t) => t.id) ?? [];

  if (tenantIds.length === 0) {
    return [];
  }

  // 2) Load balances
  const { data: balances, error: balancesError } = await supabaseAdmin.rpc(
    "get_tenant_balances",
    {
      tenant_ids: tenantIds,
    }
  );

  if (balancesError) {
    console.error("[getTenantsWithSummaries] balances error:", balancesError);
    throw balancesError;
  }

  const balanceByTenant: Record<string, { current_balance: number; last_payment_at: string | null }> =
    {};

  for (const row of balances || []) {
    balanceByTenant[row.tenant_id] = {
      current_balance: row.current_balance ?? 0,
      last_payment_at: row.last_payment_at ?? null,
    };
  }

  // 3) Merge + return
  return tenants!.map((t) => {
    const bal = balanceByTenant[t.id] || {
      current_balance: 0,
      last_payment_at: null,
    };

    return {
      id: t.id,
      full_name: t.full_name,
      email: t.email,
      unit_label: t.unit_label,
      current_balance: bal.current_balance,
      last_payment_at: bal.last_payment_at,
    };
  });
}