// owner-portal/app/tenants/page.tsx
import Link from "next/link";
import { getTenantsWithSummaries } from "../../lib/tenantSummary";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}$${abs.toFixed(2)}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleDateString();
}

export default async function TenantsPage() {
  const tenants = await getTenantsWithSummaries();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Tenants</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Overview of all residents, balances and recent payments.
            </p>
          </div>

          {/* Future: add a button to create a new tenant */}
          {/* <Link
            href="/tenants/new"
            className="inline-flex items-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            + Add tenant
          </Link> */}
        </header>

        {tenants.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-8 text-center text-sm text-neutral-400">
            No tenants found yet. Use Supabase or the future “Add tenant” page
            to create your first resident.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900/80 text-neutral-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Tenant</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-right">Current balance</th>
                  <th className="px-4 py-3 text-left">Last payment</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={
                      idx % 2 === 0
                        ? "border-t border-neutral-800"
                        : "border-t border-neutral-800 bg-neutral-900/40"
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {t.full_name || "Unnamed tenant"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {t.unit_label || "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {t.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          t.current_balance > 0
                            ? "text-red-400"
                            : t.current_balance < 0
                            ? "text-emerald-400"
                            : "text-neutral-200"
                        }
                      >
                        {formatCurrency(t.current_balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {formatDate(t.last_payment_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="inline-flex items-center rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
                      >
                        Open ledger
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
