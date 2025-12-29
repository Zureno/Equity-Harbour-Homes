// owner-portal/components/owner/CreateTenantForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTenantForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [startingBalance, setStartingBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/owner/create-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          unit_label: unitLabel,
          starting_balance: Number(startingBalance) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create tenant");
      }

      // After creating the tenant, go back to owner dashboard
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-neutral-300">Full name</label>
        <input
          type="text"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-300">Email</label>
        <input
          type="email"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-300">Unit label</label>
        <input
          type="text"
          placeholder="Unit 1110"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={unitLabel}
          onChange={(e) => setUnitLabel(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-300">
          Starting balance (optional)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={startingBalance}
          onChange={(e) => setStartingBalance(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-indigo-500 hover:bg-indigo-400 text-sm font-medium px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create tenant"}
      </button>
    </form>
  );
}
