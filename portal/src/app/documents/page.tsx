"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type TenantRow = {
  id: string;
  full_name: string | null;
  unit_label: string | null;
};

type TenantDocument = {
  id: string;
  tenant_id: string;
  title: string | null;
  file_name: string | null;
  category: string | null;
  doc_type: string | null;
  storage_path: string;
  created_at: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "unauth"; message?: string }
  | { status: "error"; message: string }
  | { status: "ready"; tenant: TenantRow; docs: TenantDocument[] };

const DEFAULT_BUCKET = "tenant-docs"; // change if your bucket has a different name

export default function DocumentsPage() {
  const bucketName = useMemo(
    () => process.env.NEXT_PUBLIC_TENANT_DOCS_BUCKET || DEFAULT_BUCKET,
    []
  );

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [uploading, setUploading] = useState(false);

  // ---------- Helpers ----------
  const loadTenantForUser = async (authUserId: string) => {
    // Try common column names: user_id first, then auth_user_id
    const tryUserId = await supabase
      .from("tenants")
      .select("id, full_name, unit_label")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (tryUserId.data) return tryUserId.data as TenantRow;

    const tryAuthUserId = await supabase
      .from("tenants")
      .select("id, full_name, unit_label")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (tryAuthUserId.data) return tryAuthUserId.data as TenantRow;

    return null;
  };

  const loadDocs = async (tenantId: string) => {
    const { data, error } = await supabase
      .from("tenant_documents")
      .select(
        "id, tenant_id, title, file_name, category, doc_type, storage_path, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as TenantDocument[];
  };

  const openSignedUrl = async (storagePath: string) => {
    // Signed URL for PRIVATE bucket access
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 60 * 10); // 10 minutes

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error("Could not generate signed URL.");
    }

    window.open(data.signedUrl, "_blank", "noreferrer");
  };

  // ---------- Load on mount ----------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setState({ status: "loading" });

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = sessionData?.session;
        if (!session) {
          if (!cancelled) setState({ status: "unauth" });
          return;
        }

        const tenantRow = await loadTenantForUser(session.user.id);

        if (!tenantRow) {
          if (!cancelled) {
            setState({
              status: "error",
              message:
                "We couldn't find a tenant record for this user. Please go back to the portal.",
            });
          }
          return;
        }

        const docs = await loadDocs(tenantRow.id);

        if (!cancelled) {
          setState({ status: "ready", tenant: tenantRow, docs });
        }
      } catch (err: any) {
        console.error("[DocumentsPage] load error:", err);
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err?.message ||
              "We couldn't load your documents. Please refresh and try again.",
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bucketName]);

  // ---------- Upload ----------
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status !== "ready") return;

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const titleInput = form.elements.namedItem("title") as HTMLInputElement;
    const categorySelect = form.elements.namedItem(
      "category"
    ) as HTMLSelectElement;

    const file = fileInput.files?.[0];
    const title = titleInput.value.trim();
    const category = (categorySelect.value || "Other").trim();

    if (!file) return;

    setUploading(true);

    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "-");
      const storagePath = `${state.tenant.id}/${Date.now()}-${safeName}`;

      // 1) Upload to PRIVATE bucket
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // 2) Insert DB row - IMPORTANT: doc_type is NOT NULL in your DB
      const payload = {
        tenant_id: state.tenant.id,
        title: title || null,
        file_name: file.name, // your table has file_name
        category, // your table has category
        doc_type: category || "Other", // satisfies NOT NULL constraint
        storage_path: storagePath,
      };

      const { error: insertError } = await supabase
        .from("tenant_documents")
        .insert(payload);

      if (insertError) throw insertError;

      // Refresh list
      const docs = await loadDocs(state.tenant.id);
      setState((prev) =>
        prev.status === "ready" ? { ...prev, docs } : prev
      );

      form.reset();
    } catch (err: any) {
      console.error("[DocumentsPage] upload error:", err);

      // Make bucket issues super obvious
      const msg =
        err?.message?.includes("Bucket not found")
          ? `Bucket not found: "${bucketName}". Create it in Supabase Storage or set NEXT_PUBLIC_TENANT_DOCS_BUCKET to the correct bucket name.`
          : err?.message || "We couldn't upload your document. Please try again.";

      setState({ status: "error", message: msg });
    } finally {
      setUploading(false);
    }
  };

  // ---------- UI states ----------
  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <span className="text-sm text-neutral-400">Loading documents…</span>
      </main>
    );
  }

  if (state.status === "unauth") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center space-y-4">
        <p className="text-sm text-neutral-300">
          {state.message || "Please sign in again to view your documents."}
        </p>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-500 text-white hover:bg-indigo-400"
        >
          Back to portal
        </Link>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center space-y-4 px-6">
        <p className="text-sm text-neutral-200 text-center max-w-xl">
          {state.message}
        </p>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-500 text-white hover:bg-indigo-400"
        >
          Back to portal
        </Link>
        <p className="text-xs text-neutral-500">
          (Storage bucket in use: <span className="font-mono">{bucketName}</span>)
        </p>
      </main>
    );
  }

  // READY
  const { tenant, docs } = state;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Lease &amp; Documents
            </p>
            <h1 className="text-2xl font-semibold mt-1">Your Documents</h1>
            <p className="text-xs text-neutral-400 mt-1">
              {tenant.full_name} – Unit {tenant.unit_label || "N/A"}
            </p>
          </div>

          <Link href="/" className="text-xs text-indigo-400 hover:underline">
            ← Back to Home
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)] gap-6">
          {/* LEFT: list */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
            <header className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm font-medium">Uploaded documents</h2>
              <span className="text-xs text-neutral-500">
                {docs.length} item{docs.length === 1 ? "" : "s"}
              </span>
            </header>

            <div className="px-4 py-3 text-sm">
              {docs.length === 0 ? (
                <p className="text-neutral-500 text-xs">
                  You haven&apos;t uploaded any documents yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((doc) => {
                    const display =
                      doc.title || doc.file_name || "Document";
                    const meta =
                      doc.category || doc.doc_type || "Other";

                    return (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between text-xs gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{display}</div>
                          <div className="text-neutral-500 truncate">
                            {meta}
                            {doc.created_at
                              ? ` · uploaded ${new Date(
                                  doc.created_at
                                ).toLocaleDateString()}`
                              : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openSignedUrl(doc.storage_path)}
                          className="shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                        >
                          View / Download
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* RIGHT: upload */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <h2 className="text-sm font-medium mb-3">Upload a document</h2>

            <form onSubmit={handleUpload} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-400">
                  File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  name="file"
                  required
                  className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm
                             file:mr-3 file:rounded-md file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5
                             file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">
                  Display name (optional)
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="Example: Signed lease 2025"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">Category</label>
                <select
                  name="category"
                  defaultValue="Lease"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Lease">Lease</option>
                  <option value="Income verification">Income verification</option>
                  <option value="ID">ID</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex w-full items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload document"}
              </button>

              <p className="text-[11px] text-neutral-500">
                Documents are stored privately. Viewing uses time-limited signed links.
              </p>
              <p className="text-[11px] text-neutral-600">
                Bucket: <span className="font-mono">{bucketName}</span>
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
