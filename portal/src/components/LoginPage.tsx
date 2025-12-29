"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

type LoginPageProps = {
  // Optional error passed from page.tsx (e.g. tenant load failed)
  errorMessage?: string;
};

const LoginPage: React.FC<LoginPageProps> = ({ errorMessage }) => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If page.tsx passes down an error, show it above the form
  useEffect(() => {
    if (errorMessage) {
      setError(errorMessage);
    }
  }, [errorMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    console.log("[LoginPage] Signing in with", email);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      console.log("[LoginPage] signInWithPassword result:", {
        data,
        signInError,
      });

      if (signInError) {
        setError(signInError.message || "Invalid email or password.");
        return;
      }

      // ✅ Hard reload so page.tsx re-runs, sees the session, and shows TenantPortal
      if (typeof window !== "undefined") {
        window.location.href = "/";
      } else {
        // Fallback for safety in non-browser env
        router.push("/");
      }
    } catch (err: any) {
      console.error("[LoginPage] unexpected sign-in error:", err);
      setError(err?.message || "Something went wrong signing you in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="EquityHarbor Homes"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              EquityHarbor Homes
            </div>
          </div>
          <h1 className="mt-3 text-xl font-semibold text-neutral-50">
            Resident Login
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Sign in to view your rent, Section 8 info and maintenance.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Email</label>
            <input
              type="email"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-semibold text-white py-2.5 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-neutral-500 text-center">
          Need an account? Ask your landlord to send you login details.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
