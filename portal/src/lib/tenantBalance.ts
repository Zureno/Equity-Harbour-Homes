// portal/src/lib/tenantBalance.ts
import { supabase } from "./supabaseClient";

export type TenantBalance = {
  tenantId: string;
  amountDue: number;
};

export async function getCurrentUserBalance(): Promise<TenantBalance | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[tenantBalance] getUser error", userError);
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenant_balances_view")
    .select("current_balance")
    .eq("tenant_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[tenantBalance] balance query error", error);
    throw error;
  }

  const raw = data?.current_balance ?? 0;

  return {
    tenantId: user.id,
    amountDue: Number(raw) || 0,
  };
}

export const getTenantBalance = getCurrentUserBalance;
