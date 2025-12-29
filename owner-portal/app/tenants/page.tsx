// owner-portal/app/tenants/page.tsx
import Link from "next/link";
import { getTenantsWithSummaries } from "../../lib/tenantSummary";

export default async function TenantsPage() {
  const tenants = await getTenantsWithSummaries();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Tenants</h1>
            <p className="text-xs text-neutral-400 mt-1">
              Overview of all tenants, their units, balances and last payments.
            </p>
          </div>

          <Link
            href="/tenants/new"
            className="inline-flex items-center rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold text-white px-4 py-2"
          >
            + Add tenant
          </Link>
        </div>

        {/* your existing table / list of tenants here */}
        {/* ... */}
      </div>
    </div>
  );
}
