// portal/app/forgot-password/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Failed to send reset email");
      return;
    }

    setMessage(
      "If that email is registered, a reset link has been sent. Check your inbox."
    );
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-8">
        <h2 className="mb-4 text-center text-lg font-semibold">
          Reset your password
        </h2>

        {error && (
          <div className="mb-3 rounded-md bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-3 rounded-md bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label className="block text-neutral-300">Email</label>
            <input
              type="email"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-500 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <button
          className="mt-4 text-xs text-neutral-400 hover:text-neutral-200"
          onClick={() => router.push("/login")}
        >
          Back to login
        </button>
      </div>
    </main>
  );
}
