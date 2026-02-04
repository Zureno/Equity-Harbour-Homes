// portal/src/lib/tenantBalance.ts
import { createServerClient } from "./supabaseServer";

/**
 * IMPORTANT:
 * - Balance is sourced from public.tenant_balances_view (single source of truth).
 * - Charges history comes from public.charges
 * - Payments history comes from public.payments
 */

export type TenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  unit_label: string | null;
};

export type ChargeRow = {
  id: string;
  tenant_id: string;
  amount: number | null;              // ✅ ONLY amount
  description: string | null;
  due_date?: string | null;
  created_at: string;
  is_paid?: boolean | null;
};

export type PaymentRow = {
  id: string;
  tenant_id: string;
  amount: number | null;              // ✅ ONLY amount
  method: string | null;
  note: string | null;
  received_at?: string | null;
  created_at: string;
  status?: string | null; // 'pending' | 'posted'
};

export type TenantBalancesViewRow = {
  tenant_id: string;
  total_charges: number | null;
  total_payments: number | null;
  current_balance: number | null;
};

export type TenantLedger = {
  tenant: TenantRow | null;
  charges: ChargeRow[];
  payments: PaymentRow[];
  balanceDollars: number;
  totals?: {
    totalCharges: number;
    totalPayments: number;
  };
};

export async function getTenantForBalance(tenantId: string): Promise<TenantRow | null> {
  if (!tenantId) return null;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, full_name, email, unit_label")
    .eq("id", tenantId)
    .single();

  if (error) {
    console.error("[tenantBalance] failed to load tenant", error);
    return null;
  }
  return (data ?? null) as TenantRow | null;
}

export async function getTenantBalanceFromView(tenantId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("tenant_balances_view")
    .select("tenant_id, total_charges, total_payments, current_balance")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[tenantBalance] tenant_balances_view fetch error:", error);
    return { balanceDollars: 0, totalCharges: 0, totalPayments: 0 };
  }

  const row = data as TenantBalancesViewRow | null;

  return {
    balanceDollars: Number(row?.current_balance) || 0,
    totalCharges: Number(row?.total_charges) || 0,
    totalPayments: Number(row?.total_payments) || 0,
  };
}

export async function getTenantLedger(tenantId: string): Promise<TenantLedger> {
  if (!tenantId) {
    return {
      tenant: null,
      charges: [],
      payments: [],
      balanceDollars: 0,
      totals: { totalCharges: 0, totalPayments: 0 },
    };
  }

  const supabase = await createServerClient();

  const tenant = await getTenantForBalance(tenantId);
  const effectiveTenantId = tenant?.id ?? tenantId;

  const { data: chargesData, error: chargesError } = await supabase
    .from("charges")
    .select("id, tenant_id, amount, description, due_date, created_at, is_paid")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (chargesError) console.error("[tenantBalance] charges fetch error:", chargesError);

  const { data: paymentsData, error: paymentsError } = await supabase
    .from("payments")
    .select("id, tenant_id, amount, method, note, received_at, created_at, status")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (paymentsError) console.error("[tenantBalance] payments fetch error:", paymentsError);

  const viewTotals = await getTenantBalanceFromView(effectiveTenantId);

  return {
    tenant,
    charges: (chargesData ?? []) as ChargeRow[],
    payments: (paymentsData ?? []) as PaymentRow[],
    balanceDollars: viewTotals.balanceDollars,
    totals: {
      totalCharges: viewTotals.totalCharges,
      totalPayments: viewTotals.totalPayments,
    },
  };
}

/**
 * If you still want "Pay with card", do NOT rely on is_paid unless you actually update it.
 * This returns the oldest unpaid charge (requires is_paid to be maintained correctly).
 */
export async function getCurrentPayableCharge(tenantId: string) {
  if (!tenantId) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("charges")
    .select("id, tenant_id, amount, description, due_date, created_at, is_paid")
    .eq("tenant_id", tenantId)
    .or("is_paid.is.null,is_paid.eq.false")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[tenantBalance] getCurrentPayableCharge error", error);
    return null;
  }

  return data as ChargeRow | null;
}
