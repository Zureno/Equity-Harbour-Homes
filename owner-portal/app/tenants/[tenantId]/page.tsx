// owner-portal/app/tenants/[tenantId]/page.tsx

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import AddChargeForm from "@/components/owner/AddChargeForm";
import AddPaymentForm from "@/components/owner/AddPaymentForm";

export const dynamic = "force-dynamic";

type Tenant = {
  id: string;
  full_name: string | null;
  email: string | null;
  unit_label: string | null;
};

type Charge = {
  id: string;
  description: string | null;
  amount: number | null;
  is_paid: boolean | null;
  due_date: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  amount: number | null;
  status: string | null;
  method: string | null;
  created_at: string;
  note: string | null;
  external_id: string | null;
  reference: string | null;
};

async function getTenantData(tenantId: string) {
  // 1) Tenant record (NO current_balance column)
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, full_name, email, unit_label")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error("Tenant fetch error", tenantError);
    return {
      error: "Could not load tenant record.",
      tenant: null as Tenant | null,
      charges: [] as Charge[],
      payments: [] as Payment[],
      balance: 0,
    };
  }

  // 2) Charges
  const { data: chargesRaw, error: chargesError } = await supabaseAdmin
    .from("charges")
    .select("id, description, amount, is_paid, due_date, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (chargesError) {
    console.error("Charges fetch error", chargesError);
  }

  const charges = (chargesRaw ?? []) as Charge[];

  // 3) Payments
  const { data: paymentsRaw, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select(
      "id, amount, status, method, created_at, note, external_id, reference"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("Payments fetch error", paymentsError);
  }

  const payments = (paymentsRaw ?? []) as Payment[];

  // 4) Compute balance: total charges - total payments
  const totalCharges = charges.reduce(
    (sum, c) => sum + (c.amount ? Number(c.amount) : 0),
    0
  );
  const totalPayments = payments.reduce(
    (sum, p) => sum + (p.amount ? Number(p.amount) : 0),
    0
  );
  const balance = totalCharges - totalPayments;

  return {
    error: null,
    tenant: tenant as Tenant,
    charges,
    payments,
    balance,
  };
}

// Note: params is a **Promise** in Next.js 16 app router for dynamic routes
export default async function TenantLedgerPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const { tenant, charges, payments, balance, error } = await getTenantData(
    tenantId
  );

  if (!tenant) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-neutral-900 border border-red-900/60 rounded-2xl p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Unable to load ledger</h1>
          <p className="text-sm text-neutral-300 mb-4">
            {error || "Tenant record could not be loaded from Supabase."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-medium"
          >
            Back to tenants
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header / breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-neutral-500 mb-1">
              <Link href="/" className="hover:underline">
                Tenants
              </Link>{" "}
              / Ledger
            </p>
            <h1 className="text-xl font-semibold">
              {tenant.full_name || "Tenant"} –{" "}
              <span className="text-neutral-300">
                Unit {tenant.unit_label || "Unknown"}
              </span>
            </h1>
            <p className="mt-1 text-xs text-neutral-400">{tenant.email}</p>
          </div>

          <div className="text-right">
            <p className="text-xs text-neutral-500">Current balance</p>
            <p className="text-2xl font-semibold">
              {balance.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
            <p className="text-[11px] text-neutral-500">
              (Charges − payments, from ledger)
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Left: Charges + Payments */}
          <div className="md:col-span-2 space-y-4">
            {/* Charges */}
            <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Charges</h2>
              </div>
              <div className="space-y-2 text-xs">
                {charges.length === 0 && (
                  <p className="text-neutral-500 text-xs">
                    No charges yet for this tenant.
                  </p>
                )}
                {charges.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between border-b border-neutral-800/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-neutral-100">
                        {c.description || "Charge"}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {c.due_date
                          ? `Due ${new Date(c.due_date).toLocaleDateString()}`
                          : new Date(c.created_at).toLocaleDateString()}{" "}
                        · {c.is_paid ? "Paid" : "Unpaid"}
                      </p>
                    </div>
                    <div className="font-mono">
                      ${Number(c.amount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Payments */}
            <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Payments</h2>
              </div>
              <div className="space-y-2 text-xs">
                {payments.length === 0 && (
                  <p className="text-neutral-500 text-xs">
                    No payments recorded yet.
                  </p>
                )}
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b border-neutral-800/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-neutral-100">
                        ${Number(p.amount || 0).toFixed(2)} ·{" "}
                        {p.method || "method"} · {p.status || "status"}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {new Date(p.created_at).toLocaleDateString()}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: forms */}
          <div className="space-y-4">
            <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-3">Add manual charge</h2>
              <AddChargeForm tenantId={tenantId} />
            </section>

            <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4">
              <h2 className="text-sm font-semibold mb-3">
                Record offline payment
              </h2>
              <AddPaymentForm tenantId={tenantId} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
