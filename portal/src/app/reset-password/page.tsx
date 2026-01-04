// portal/app/reset-password/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // This causes Supabase JS to parse the hash & set a session if valid
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
      } else {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setError(error.message || "Failed to update password");
      return;
    }

    setMessage("Password updated. You can now log in with your new password.");
    setTimeout(() => router.push("/login"), 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 px-6 py-8">
        <h2 className="mb-4 text-center text-lg font-semibold">
          Choose a new password
        </h2>

        {!ready && !error && (
          <p className="text-sm text-neutral-400">Validating reset link…</p>
        )}

        {error && (
          <div className="mb-3 rounded-md bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {ready && !error && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1 text-sm">
              <label className="block text-neutral-300">New password</label>
              <input
                type="password"
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1 text-sm">
              <label className="block text-neutral-300">
                Confirm new password
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-indigo-500 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        )}

        {message && (
          <div className="mt-3 rounded-md bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
