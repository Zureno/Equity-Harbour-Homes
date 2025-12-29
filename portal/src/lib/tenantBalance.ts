// portal/src/lib/tenantBalance.ts
import { supabase } from "./supabaseClient";

export type TenantBalance = {
  currentBalance: number;   // charges - payments
  amountDue: number;        // never negative (credits become 0)
};

/**
 * Compute the current balance for a tenant based on:
 *   - charges table
 *   - payments table (only status='paid')
 */
export async function getTenantBalance(
  tenantId: string
): Promise<TenantBalance> {
  // 1) All charges for this tenant
  const { data: charges, error: chargesError } = await supabase
    .from("charges")
    .select("amount")
    .eq("tenant_id", tenantId);

  if (chargesError) {
    console.error("[getTenantBalance] chargesError", chargesError);
    throw chargesError;
  }

  // 2) All *paid* payments for this tenant
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("tenant_id", tenantId)
    .eq("status", "paid");

  if (paymentsError) {
    console.error("[getTenantBalance] paymentsError", paymentsError);
    throw paymentsError;
  }

  const chargesTotal =
    charges?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0;

  const paymentsTotal =
    payments?.reduce((sum, row) => sum + (row.amount ?? 0), 0) ?? 0;

  const currentBalance = chargesTotal - paymentsTotal;
  const amountDue = currentBalance > 0 ? currentBalance : 0;

  return {
    currentBalance,
    amountDue,
  };
}
