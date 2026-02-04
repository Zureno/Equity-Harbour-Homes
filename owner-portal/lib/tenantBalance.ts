// portal/src/lib/tenantBalance.ts
import { createServerClient } from "./supabaseServer";

export type TenantRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  unit_label: string | null;
};

export type ChargeRow = {
  id: string;
  tenant_id: string;
  amount: number | null;
  description: string | null;
  due_date?: string | null;
  created_at: string;
  is_paid?: boolean | null;
};

export type PaymentRow = {
  id: string;
  tenant_id: string;
  amount: number | null;
  method: string | null;
  note: string | null;
  received_at?: string | null;
  created_at: string;

  status?: string | null;
  source?: string | null;
  posted_at?: string | null;
};

export type TenantLedger = {
  tenant: TenantRow | null;
  charges: ChargeRow[];
  payments: PaymentRow[];
  balanceDollars: number;
  totals?: { totalCharges: number; totalPaymentsPosted: number };
};

function toDollars(amount: any): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

export async function getTenantForBalance(tenantId: string): Promise<TenantRow | null> {
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

export async function getTenantLedger(tenantId: string): Promise<TenantLedger> {
  const supabase = await createServerClient();

  const tenant = await getTenantForBalance(tenantId);
  const effectiveTenantId = tenant?.id ?? tenantId;

  const { data: chargesData, error: chargesError } = await supabase
    .from("charges")
    .select("id, tenant_id, amount, description, due_date, created_at, is_paid")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (chargesError) console.error("[tenantBalance] charges fetch error:", chargesError);

  const charges: ChargeRow[] = (chargesData ?? []) as ChargeRow[];

  const { data: paymentsData, error: paymentsError } = await supabase
    .from("payments")
    .select("id, tenant_id, amount, method, note, received_at, created_at, status, source, posted_at")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (paymentsError) console.error("[tenantBalance] payments fetch error:", paymentsError);

  const payments: PaymentRow[] = (paymentsData ?? []) as PaymentRow[];

  const totalCharges = charges.reduce((sum, c) => sum + toDollars(c.amount), 0);

  const totalPaymentsPosted = payments
    .filter((p) => (p.status ?? "pending") === "posted" || p.source === "stripe")
    .reduce((sum, p) => sum + toDollars(p.amount), 0);

  const balanceDollars = totalCharges - totalPaymentsPosted;

  return {
    tenant,
    charges,
    payments,
    balanceDollars,
    totals: { totalCharges, totalPaymentsPosted },
  };
}

export async function getCurrentPayableCharge(tenantId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("charges")
    .select("id, tenant_id, amount, description, due_date, created_at, is_paid")
    .eq("tenant_id", tenantId)
    .eq("is_paid", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[tenantBalance] getCurrentPayableCharge error", error);
    return null;
  }

  return data as ChargeRow | null;
}

export async function getCurrentPayableChargeWithAmount(tenantId: string) {
  const ledger = await getTenantLedger(tenantId);
  if (ledger.balanceDollars <= 0) return null;

  // pick a charge to attach Stripe to (oldest by due_date)
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("charges")
    .select("id, tenant_id, amount, description, due_date, created_at, is_paid")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return { ...(data as ChargeRow), amountDollars: Math.min(toDollars(data.amount), ledger.balanceDollars) };
}
