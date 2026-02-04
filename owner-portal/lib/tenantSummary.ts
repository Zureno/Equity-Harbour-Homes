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

  if (!tenants || tenants.length === 0) return [];

  const tenantIds = tenants.map((t) => t.id);

  // 2) Load balances from the SAME source tenant portal uses
  const { data: balances, error: balancesError } = await supabaseAdmin
    .from("tenant_balances_view")
    .select("tenant_id, current_balance")
    .in("tenant_id", tenantIds);

  if (balancesError) {
    console.error("[getTenantsWithSummaries] balances error:", balancesError);
    throw balancesError;
  }

  const balanceMap = new Map<string, number>();
  (balances || []).forEach((b: any) => {
    balanceMap.set(b.tenant_id, Number(b.current_balance ?? 0));
  });

  // 3) Load payments only to show last payment date
  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("tenant_id, created_at, posted_at, status")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("[getTenantsWithSummaries] payments error:", paymentsError);
    throw paymentsError;
  }

  const lastPaymentDate = new Map<string, string>();

  // Choose last *posted* payment if you want strict correctness.
  // If you want last payment regardless of status, remove the filter.
  (payments || [])
    .filter((p: any) => (p.status ?? "posted") === "posted")
    .forEach((p: any) => {
      if (!lastPaymentDate.has(p.tenant_id)) {
        lastPaymentDate.set(p.tenant_id, p.posted_at ?? p.created_at);
      }
    });

  // 4) Combine
  return tenants.map((t) => ({
    id: t.id,
    full_name: t.full_name ?? "",
    email: t.email ?? "",
    unit_label: t.unit_label ?? "",
    current_balance: balanceMap.get(t.id) ?? 0,
    last_payment_at: lastPaymentDate.get(t.id) ?? null,
  }));
}
