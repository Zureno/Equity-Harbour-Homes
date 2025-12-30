"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function OwnerLoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Login failed.");
        return;
      }

      const target = searchParams.get("from") || "/";
      router.push(target);
      router.refresh();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-black border border-neutral-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <h1 className="text-lg font-semibold text-neutral-100">
          EquityHarbor Owner Portal
        </h1>
        <p className="text-xs text-neutral-400">
          For EquityHarbor Homes staff only.
        </p>

        <input
          type="password"
          className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Owner password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
