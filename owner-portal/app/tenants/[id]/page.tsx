// owner-portal/app/tenants/[id]/page.tsx

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

/* ---------- Server actions ---------- */

async function createCharge(formData: FormData) {
  "use server";

  // Service-role client = bypass RLS for owner writes
  const supabase = supabaseAdmin;

  const tenantId = formData.get("tenant_id") as string | null;
  const amount = Number(formData.get("amount") || 0);
  const description = String(formData.get("description") || "");
  const dueDateRaw = formData.get("due_date") as string | null;

  if (!tenantId || !Number.isFinite(amount) || !description.trim()) {
    console.error("[createCharge] Missing or invalid form data", {
      tenantId,
      amount,
      description,
    });
    return;
  }

  const dueDate = dueDateRaw ? new Date(dueDateRaw).toISOString() : null;

  const { error } = await supabase.from("charges").insert({
    tenant_id: tenantId,
    amount,
    description,
    due_date: dueDate,
    type: "rent", // NOT NULL column
  });

  if (error) {
    console.error("[createCharge] Supabase error:", error);
  }

  revalidatePath(`/tenants/${tenantId}`);
}

async function recordPayment(formData: FormData) {
  "use server";

  // Service-role client for payments as well
  const supabase = supabaseAdmin;

  const tenantId = formData.get("tenant_id") as string | null;
  const amount = Number(formData.get("amount") || 0);
  const method = String(formData.get("method") || "");
  const note = String(formData.get("note") || "");

  if (!tenantId || !Number.isFinite(amount) || !method.trim()) {
    console.error("[recordPayment] Missing or invalid form data", {
      tenantId,
      amount,
      method,
    });
    return;
  }

  const { error } = await supabase.from("payments").insert({
    tenant_id: tenantId,
    amount,
    method,
    note,
    // If you later add paid_at:
    // paid_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[recordPayment] Supabase error:", error);
  }

  revalidatePath(`/tenants/${tenantId}`);
}

/* ---------- Page component ---------- */

export default async function TenantLedgerPage(props: PageProps) {
  // In your setup, params is a Promise
  const { id: tenantId } = await props.params;

  // RLS-aware client for tenant metadata
  const supabaseRls = await createServerClient();
  // Service-role client for ledger data (charges / payments)
  const admin = supabaseAdmin;

  // 1) Load tenant
  const {
    data: tenant,
    error: tenantError,
  } = await supabaseRls
    .from("tenants")
    .select("id, full_name, email, unit_label")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) {
    console.error("[TenantLedgerPage] Tenant fetch error:", tenantError);
  }

  if (!tenant) {
    console.error("[TenantLedgerPage] No tenant found for id:", tenantId);
    notFound();
  }

  // 2) Load charges (use service-role so owner can see everything)
  const {
    data: rawCharges,
    error: chargesError,
  } = await admin
    .from("charges")
    .select("id, amount, description, due_date, created_at")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: true });

  if (chargesError) {
    console.error("[TenantLedgerPage] charges fetch error:", chargesError);
  }

  const charges = (rawCharges ?? []) as any[];

  // 3) Load payments (also via service-role)
  const {
    data: rawPayments,
    error: paymentsError,
  } = await admin
    .from("payments")
    .select("id, amount, method, note, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    console.error("[TenantLedgerPage] payments fetch error:", paymentsError);
  }

  const payments = (rawPayments ?? []) as any[];

  // If you add starting_balance later, swap this line to tenant.starting_balance ?? 0
  const startingBalance = 0;

  const chargesTotal = charges.reduce(
    (sum: number, c: any) => sum + (c.amount ?? 0),
    0
  );
  const paymentsTotal = payments.reduce(
    (sum: number, p: any) => sum + (p.amount ?? 0),
    0
  );

  const currentBalance = startingBalance + chargesTotal - paymentsTotal;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Tenants / Ledger
            </div>
            <h1 className="text-2xl font-semibold mt-1">
              {tenant.full_name || "Unnamed tenant"} – Unit{" "}
              {tenant.unit_label || "N/A"}
            </h1>
            <div className="text-xs text-neutral-400 mt-1">
              {tenant.email}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Current balance
            </div>
            <div className="text-2xl font-semibold">
              ${currentBalance.toFixed(2)}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">
              (Charges – payments, from ledger)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
          {/* LEFT: Charges + Payments lists */}
          <div className="space-y-4">
            {/* Charges */}
            <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
              <header className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-sm font-medium">Charges</h2>
                <span className="text-xs text-neutral-500">
                  {charges.length} item{charges.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="px-4 py-3 text-sm">
                {charges.length === 0 ? (
                  <p className="text-neutral-500">
                    No charges yet for this tenant.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {charges.map((c: any) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium">{c.description}</div>
                          <div className="text-neutral-500">
                            Due{" "}
                            {c.due_date
                              ? new Date(c.due_date).toLocaleDateString()
                              : "—"}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ${Number(c.amount ?? 0).toFixed(2)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Payments */}
            <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
              <header className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-sm font-medium">Payments</h2>
                <span className="text-xs text-neutral-500">
                  {payments.length} item{payments.length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="px-4 py-3 text-sm">
                {payments.length === 0 ? (
                  <p className="text-neutral-500">
                    No payments recorded yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {payments.map((p: any) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium">
                            {p.method || "Payment"}
                          </div>
                          <div className="text-neutral-500">
                            {p.created_at
                              ? new Date(p.created_at).toLocaleDateString()
                              : "—"}
                            {p.note ? ` · ${p.note}` : null}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ${Number(p.amount ?? 0).toFixed(2)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT: Charge + Payment forms */}
          <div className="space-y-4">
            {/* Add charge */}
            <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <h2 className="text-sm font-medium mb-3">Add manual charge</h2>
              <form action={createCharge} className="space-y-3">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Amount</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="Example: 850.00"
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">
                    Description
                  </label>
                  <input
                    name="description"
                    defaultValue="Monthly rent"
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">
                    Due date{" "}
                    <span className="text-neutral-600">
                      (optional, used for past-due flags)
                    </span>
                  </label>
                  <input
                    name="due_date"
                    type="date"
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
                >
                  Create charge
                </button>
              </form>
            </section>

            {/* Record payment */}
            <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <h2 className="text-sm font-medium mb-3">
                Record offline payment
              </h2>
              <form action={recordPayment} className="space-y-3">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Amount</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    placeholder="Example: 400.00"
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">Method</label>
                  <select
                    name="method"
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    defaultValue="Cash"
                  >
                    <option>Cash</option>
                    <option>Money order</option>
                    <option>Cashier&apos;s check</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400">
                    Note{" "}
                    <span className="text-neutral-600">
                      (optional, internal)
                    </span>
                  </label>
                  <textarea
                    name="note"
                    rows={2}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                    placeholder="Example: Money order #1234, received by Sam."
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
                >
                  Save payment
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
