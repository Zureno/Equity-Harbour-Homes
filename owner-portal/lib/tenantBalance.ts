// owner-portal/src/lib/tenantBalance.ts

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Shapes used by the ledger page.
 * Adjust field names if your tables differ.
 */

export type TenantRow = {
  id: string;
  full_name: string | null;
  email: string;
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
 * Load tenant + all charges & payments for that tenant.
 * IMPORTANT: this never sends an `undefined` id to Postgres.
 */
export async function getTenantLedger(tenantId: string): Promise<TenantLedger> {
  // Guard against bad calls
  if (!tenantId) {
    console.error("getTenantLedger called without tenantId");
    return {
      tenant: null,
      charges: [],
      payments: [],
      balanceCents: 0,
    };
  }

  // 1) Tenant row
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select<"*,full_name,email,unit_label", TenantRow>("id, full_name, email, unit_label")
    .eq("id", tenantId)
    .single();

  if (tenantError) {
    console.error("Tenant fetch error:", tenantError);
    return {
      tenant: null,
      charges: [],
      payments: [],
      balanceCents: 0,
    };
  }

  // 2) Charges
  const { data: charges = [], error: chargesError } = await supabaseAdmin
    .from("tenant_charges")
    .select<"*", ChargeRow>("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (chargesError) {
    console.error("Charges fetch error:", chargesError);
  }

  // 3) Payments
  const { data: payments = [], error: paymentsError } = await supabaseAdmin
    .from("tenant_payments")
    .select<"*", PaymentRow>("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Payments fetch error:", paymentsError);
  }

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
