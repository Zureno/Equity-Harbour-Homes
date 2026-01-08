// portal/app/login/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResidentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error || !data.session) {
      setError("Invalid login credentials");
      return;
    }

    // After login, send them to tenant dashboard (adjust route as needed)
    router.push("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-8">
        <h1 className="mb-2 text-center text-sm tracking-[0.2em] text-neutral-400">
          EQUITYHARBOR HOMES
        </h1>
        <h2 className="mb-6 text-center text-xl font-semibold">
          Resident Login
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
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

          <div className="space-y-1 text-sm">
            <label className="block text-neutral-300">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-indigo-500 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
          <span>Need an account? Ask your landlord.</span>
          <button
            type="button"
            className="text-indigo-400 hover:text-indigo-300"
            onClick={() => router.push("/forgot-password")}
          >
            Forgot password?
          </button>
        </div>
      </div>
    </main>
  );
}
