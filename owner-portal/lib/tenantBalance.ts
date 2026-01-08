// portal/src/lib/tenantBalance.ts

import { createServerClient } from './supabaseServer';

/**
 * Shapes used by the tenant portal for balances & ledger.
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
  // optional because older rows may not have it yet
  is_paid?: boolean | null;
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
 * Load a single tenant row for the balance / ledger view
 * in the tenant portal.
 */
export async function getTenantForBalance(
  tenantId: string
): Promise<TenantRow | null> {
  if (!tenantId) {
    console.error(
      '[tenantBalance] getTenantForBalance called without tenantId'
    );
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('id, full_name, email, unit_label')
    .eq('id', tenantId)
    .single();

  if (error) {
    console.error('[tenantBalance] failed to load tenant', error);
    return null;
  }

  if (!data) return null;

  return data as TenantRow;
}

/**
 * Load tenant + all charges & payments for that tenant
 * for display in the tenant portal (summary + history).
 */
export async function getTenantLedger(
  tenantId: string
): Promise<TenantLedger> {
  if (!tenantId) {
    console.error('[tenantBalance] getTenantLedger called without tenantId');
    return {
      tenant: null,
      charges: [],
      payments: [],
      balanceCents: 0,
    };
  }

  const supabase = await createServerClient();

  // 1) Tenant details
  const tenant = await getTenantForBalance(tenantId);
  const effectiveTenantId = tenant?.id ?? tenantId;

  // 2) Charges (newest first for history)
  const {
    data: chargesData,
    error: chargesError,
  } = await supabase
    .from('tenant_charges')
    .select('*')
    .eq('tenant_id', effectiveTenantId)
    .order('created_at', { ascending: false });

  if (chargesError) {
    console.error('[tenantBalance] charges fetch error:', chargesError);
  }

  const charges: ChargeRow[] = (chargesData ?? []) as ChargeRow[];

  // 3) Payments (newest first for history)
  const {
    data: paymentsData,
    error: paymentsError,
  } = await supabase
    .from('tenant_payments')
    .select('*')
    .eq('tenant_id', effectiveTenantId)
    .order('created_at', { ascending: false });

  if (paymentsError) {
    console.error('[tenantBalance] payments fetch error:', paymentsError);
  }

  const payments: PaymentRow[] = (paymentsData ?? []) as PaymentRow[];

  // 4) Compute balance = sum(charges) - sum(payments)
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

/**
 * Oldest unpaid charge for a tenant.
 * This is the charge we attach Stripe card payments to.
 */
export async function getCurrentPayableCharge(tenantId: string) {
  if (!tenantId) {
    console.error(
      '[tenantBalance] getCurrentPayableCharge called without tenantId'
    );
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('tenant_charges')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_paid', false) // make sure you have this boolean column
    .order('due_date', { ascending: true }) // oldest first
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[tenantBalance] getCurrentPayableCharge error', error);
    return null;
  }

  return data as ChargeRow | null;
}
