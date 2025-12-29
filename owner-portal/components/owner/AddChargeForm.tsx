// src/components/owner/AddChargeForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tenantId: string;
};

const AddChargeForm: React.FC<Props> = ({ tenantId }) => {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Monthly rent");
  const [dueDate, setDueDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = parseFloat(amount);
    if (!parsed || !isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid charge amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/add-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          amount: parsed,
          description,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create charge.");
      }

      setMessage("Charge created.");
      setAmount("");
      setDescription("Monthly rent");
      // leave due date as-is so you can add multiple quickly

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
        <h2 className="text-sm font-semibold">Add charge</h2>
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
            placeholder="Example: 850.00"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-300">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Example: June 2026 rent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-300">
            Due date{" "}
            <span className="text-neutral-500 text-[10px]">
              (optional, used for past-due flags)
            </span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Create charge"}
        </button>
      </form>
    </section>
  );
};

export default AddChargeForm;
