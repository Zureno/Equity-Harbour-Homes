// owner-portal/src/lib/tenantBalance.ts

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Shapes used by the ledger page.
 * Adjust field names if your tables differ.
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
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  tenant_id: string;
  amount_cents: number;
  method: string | null;
  note: string | null;
  received_at: string | null;
  created_at: string;
};

export type TenantLedger = {
  tenant: TenantRow | null;
  charges: ChargeRow[];
  payments: PaymentRow[];
  balanceCents: number;
};

/**
 * Load a single tenant row for the balance / ledger view.
 */
export async function getTenantForBalance(
  tenantId: string
): Promise<TenantRow | null> {
  if (!tenantId) {
    console.error("[tenantBalance] getTenantForBalance called without tenantId");
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, full_name, email, unit_label")
    .eq("id", tenantId)
    .single();

  if (error) {
    console.error("[tenantBalance] failed to load tenant", error);
    return null;
  }

  if (!data) return null;

  return data as TenantRow;
}

/**
 * Load tenant + all charges & payments for that tenant.
 */
export async function getTenantLedger(
  tenantId: string
): Promise<TenantLedger> {
  // Guard against bad calls
  if (!tenantId) {
    console.error("[tenantBalance] getTenantLedger called without tenantId");
    return {
      tenant: null,
      charges: [],
      payments: [],
      balanceCents: 0,
    };
  }

  // 1) Tenant details
  const tenant = await getTenantForBalance(tenantId);
  const effectiveTenantId = tenant?.id ?? tenantId;

  // 2) Charges
  const {
    data: chargesData,
    error: chargesError,
  } = await supabaseAdmin
    .from("tenant_charges")
    .select("*")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (chargesError) {
    console.error("[tenantBalance] charges fetch error:", chargesError);
  }

  const charges: ChargeRow[] = (chargesData ?? []) as ChargeRow[];

  // 3) Payments
  const {
    data: paymentsData,
    error: paymentsError,
  } = await supabaseAdmin
    .from("tenant_payments")
    .select("*")
    .eq("tenant_id", effectiveTenantId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("[tenantBalance] payments fetch error:", paymentsError);
  }

  const payments: PaymentRow[] = (paymentsData ?? []) as PaymentRow[];

  // 4) Compute balance
  const totalCharges = charges.reduce(
    (sum, c) => sum + (c.amount_cents ?? 0),
    0
  );
  const totalPayments = payments.reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0
  );

  return {
    tenant,
    charges,
    payments,
    balanceCents: totalCharges - totalPayments,
  };
}
