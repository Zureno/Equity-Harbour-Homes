// owner-portal/app/tenants/new/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  full_name: string;
  email: string;
  unit_label: string;
};

export default function NewTenantPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    unit_label: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null,
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);

    if (!form.full_name || !form.email) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/tenants/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          unit_label: form.unit_label || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create tenant.");
      }

      setSuccess("Tenant created successfully.");
      if (data.tempPassword) {
        setGeneratedPassword(data.tempPassword as string);
      }

      // optional: clear form but keep password visible
      setForm({
        full_name: "",
        email: "",
        unit_label: "",
      });
    } catch (err: any) {
      console.error("[NewTenantPage] create error", err);
      setError(err.message || "Unexpected error creating tenant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-800">
        <h1 className="text-xl font-semibold">Add new tenant</h1>
        <button
          onClick={() => router.push("/tenants")}
          className="px-3 py-1 rounded-full border border-neutral-700 hover:bg-neutral-900 text-xs"
        >
          Back to tenants
        </button>
      </header>

      <main className="px-8 py-6 max-w-2xl mx-auto">
        <section className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold mb-4">Tenant details</h2>

          {error && (
            <div className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/50 rounded-md px-3 py-2">
              {success}
            </div>
          )}

          {generatedPassword && (
            <div className="mb-4 text-xs bg-neutral-900 border border-indigo-500/60 rounded-md px-3 py-3">
              <div className="font-semibold text-indigo-300 mb-1">
                Temporary password
              </div>
              <div className="font-mono text-sm bg-black/60 px-2 py-1 rounded inline-block">
                {generatedPassword}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Share this password with the tenant. They should log in and
                change it on first use.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="block text-neutral-300" htmlFor="full_name">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-50"
                placeholder="Pranshu Raghav"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-neutral-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-50"
                placeholder="tenant@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-neutral-300" htmlFor="unit_label">
                Unit (optional)
              </label>
              <input
                id="unit_label"
                name="unit_label"
                value={form.unit_label}
                onChange={handleChange}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-50"
                placeholder="Unit 5115"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create tenant"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
