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

  if (!tenants || tenants.length === 0) {
    return [];
  }

  const tenantIds = tenants.map((t) => t.id);

  // 2) Load all charges for these tenants
  const { data: charges, error: chargesError } = await supabaseAdmin
    .from("charges")
    .select("tenant_id, amount")
    .in("tenant_id", tenantIds);

  if (chargesError) {
    console.error("[getTenantsWithSummaries] charges error:", chargesError);
    throw chargesError;
  }

  // 3) Load all payments for these tenants
  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("tenant_id, amount, created_at")
    .in("tenant_id", tenantIds)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("[getTenantsWithSummaries] payments error:", paymentsError);
    throw paymentsError;
  }

  // 4) Build maps for totals + last payment date
  const chargeTotals = new Map<string, number>();
  const paymentTotals = new Map<string, number>();
  const lastPaymentDate = new Map<string, string>();

  (charges || []).forEach((c) => {
    const prev = chargeTotals.get(c.tenant_id) ?? 0;
    chargeTotals.set(c.tenant_id, prev + Number(c.amount || 0));
  });

  (payments || []).forEach((p) => {
    const prev = paymentTotals.get(p.tenant_id) ?? 0;
    paymentTotals.set(p.tenant_id, prev + Number(p.amount || 0));

    // last payment = first in the sorted list, so set only if not present
    if (!lastPaymentDate.has(p.tenant_id)) {
      lastPaymentDate.set(p.tenant_id, p.created_at);
    }
  });

  // 5) Combine everything into TenantSummary[]
  const summaries: TenantSummary[] = tenants.map((t) => {
    const totalCharges = chargeTotals.get(t.id) ?? 0;
    const totalPayments = paymentTotals.get(t.id) ?? 0;

    return {
      id: t.id,
      full_name: t.full_name ?? "",
      email: t.email ?? "",
      unit_label: t.unit_label ?? "",
      current_balance: totalCharges - totalPayments,
      last_payment_at: lastPaymentDate.get(t.id) ?? null,
    };
  });

  return summaries;
}