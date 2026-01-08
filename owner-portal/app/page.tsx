// owner-portal/app/page.tsx
import Link from "next/link";
import { getTenantsWithSummaries } from "@/lib/tenantSummary";
import DeleteTenantButton from "@/components/owner/DeleteTenantButton";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  const tenants = await getTenantsWithSummaries();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Owner dashboard</h1>

          <Link
            href="/tenants/new"
            className="inline-flex items-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Add tenant
          </Link>
        </div>

        {tenants.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-sm text-neutral-300">
            You don’t have any tenants yet. Click{" "}
            <span className="font-semibold">Add tenant</span> to create your
            first one.
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {t.full_name || "Unnamed tenant"}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {t.unit_label || "Unit not set"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Balance:{" "}
                    <span
                      className={
                        t.current_balance > 0
                          ? "text-red-400"
                          : t.current_balance < 0
                          ? "text-emerald-400"
                          : "text-neutral-300"
                      }
                    >
                      ${t.current_balance.toFixed(2)}
                    </span>
                    {t.last_payment_at && (
                      <span className="ml-3">
                        Last payment:{" "}
                        {new Date(t.last_payment_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: Open ledger + Delete */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tenants/${t.id}`}
                    className="inline-flex items-center rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-50 hover:bg-neutral-700"
                  >
                    Open ledger
                  </Link>

                  <DeleteTenantButton
                    tenantId={t.id}
                    tenantName={t.full_name || "Unnamed tenant"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}