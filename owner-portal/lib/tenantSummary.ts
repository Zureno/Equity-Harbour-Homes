// owner-portal/lib/tenantSummary.ts
import { supabase } from "@/lib/supabaseClient";  // ⬅️ reuse your existing client

export type TenantSummary = {
  id: string;
  full_name: string | null;
  unit_label: string | null;
  current_balance: number;
  last_payment_at: string | null;
};

export async function getTenantsWithSummaries(): Promise<TenantSummary[]> {
  // 1) Base tenant info
  const { data: tenantRows, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, full_name, unit_label")
    .order("full_name", { ascending: true });

  if (tenantErr) {
    console.error("tenantErr", tenantErr);
    throw tenantErr;
  }

  // 2) Balances from the VIEW (tenant_balances_view)
  const { data: balanceRows, error: balanceErr } = await supabase
    .from("tenant_balances_view")
    .select("tenant_id, current_balance");

  if (balanceErr) {
    console.error("balanceErr", balanceErr);
    throw balanceErr;
  }

  const balanceMap = new Map<string, number>(
    (balanceRows ?? []).map((b) => [b.tenant_id, b.current_balance ?? 0])
  );

  // 3) Last payment date per tenant
  const { data: paymentRows, error: paymentErr } = await supabase
    .from("payments")
    .select("tenant_id, created_at")
    .order("created_at", { ascending: false });

  if (paymentErr) {
    console.error("paymentErr", paymentErr);
    throw paymentErr;
  }

  const lastPaymentMap = new Map<string, string>();
  (paymentRows ?? []).forEach((p) => {
    if (!lastPaymentMap.has(p.tenant_id)) {
      lastPaymentMap.set(p.tenant_id, p.created_at);
    }
  });

  // 4) Combine into what OwnerDashboardPage expects
  return (tenantRows ?? []).map((t) => ({
    id: t.id,
    full_name: t.full_name,
    unit_label: t.unit_label,
    current_balance: balanceMap.get(t.id) ?? 0,
    last_payment_at: lastPaymentMap.get(t.id) ?? null,
  }));
}
