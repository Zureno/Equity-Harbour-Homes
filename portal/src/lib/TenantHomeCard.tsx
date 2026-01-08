// portal/src/components/TenantHomeCard.tsx
"use client";

import { useEffect, useState } from "react";
import {
  getCurrentUserBalance,
  TenantBalance,
} from "../lib/tenantBalance";

export function TenantHomeCard() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<TenantBalance | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const b = await getCurrentUserBalance();
        setBalance(b);
      } catch (e) {
        console.error("[TenantHomeCard] failed to load balance", e);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const amountDue = balance?.amountDue ?? 0;

  return (
    <section className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
      <div className="text-xs uppercase text-neutral-500">
        Tenant Portion Due (this month)
      </div>

      <div className="text-3xl font-semibold mt-1">
        {loading ? "…" : `$${amountDue.toFixed(2)}`}
      </div>

      <div className="mt-3 text-sm space-y-1">
        <div>
          <span className="text-neutral-400">Section 8 pays: </span>
          {/* For now we treat everything as tenant portion; HAP = 0 */}
          <span className="text-emerald-400">$0.00</span>
        </div>
        <div>
          <span className="text-neutral-400">Your portion: </span>
          <span className="text-neutral-50">
            {loading ? "…" : `$${amountDue.toFixed(2)}`}
          </span>
        </div>
      </div>

      {!loading && !balance && (
        <p className="mt-2 text-xs text-red-400">
          We couldn&apos;t load your latest balance yet. Amounts may be
          slightly out of date.
        </p>
      )}
    </section>
  );
}
