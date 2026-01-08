// src/components/owner/AddPaymentForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tenantId: string;
  tenantName?: string; // optional – page can omit it
};

const AddPaymentForm: React.FC<Props> = ({ tenantId, tenantName }) => {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = parseFloat(amount);
    if (!parsed || !isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/add-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          amount: parsed,
          method,
          note,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to record payment.");
      }

      setMessage("Payment recorded and applied to oldest unpaid charges.");
      setAmount("");
      setNote("");

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Record payment{tenantName ? ` for ${tenantName}` : ""}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-neutral-300">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Example: 400.00"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-300">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
          >
            <option>Cash</option>
            <option>Money order</option>
            <option>Cashier&apos;s check</option>
            <option>Card in office</option>
            <option>Other</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-neutral-300">
            Note{" "}
            <span className="text-neutral-500 text-[10px]">
              (optional, internal)
            </span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[70px] rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Example: Money order #1234, received by Sam."
          />
        </div>

        {error && (
          <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {message && (
          <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 rounded-md px-3 py-2">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save payment"}
        </button>
      </form>
    </section>
  );
};

export default AddPaymentForm;
