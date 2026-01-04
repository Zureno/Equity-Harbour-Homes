"use client";

import React, { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type TenantRow = {
  id: string;
  full_name: string | null;
  unit_label: string | null;
};

type TenantDocument = {
  id: number;
  file_name: string;
  category: string | null;
  storage_path: string;
  uploaded_at: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "unauth"; message?: string }
  | { status: "ready"; tenant: TenantRow; docs: TenantDocument[] };

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// Helper to turn a storage path into a public URL
function toPublicUrl(path: string) {
  // Bucket is assumed to be public
  return `${projectUrl}/storage/v1/object/public/tenant-documents/${encodeURIComponent(
    path
  )}`;
}

export default function DocumentsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ---------- Load tenant + docs on mount ----------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError(null);
        setState({ status: "loading" });

        // 1) Check auth session
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = data?.session;
        if (!session) {
          if (!cancelled) setState({ status: "unauth" });
          return;
        }

        // 2) Find tenant row for this user
        const { data: tenantRow, error: tenantError } = await supabase
          .from("tenants")
          .select("id, full_name, unit_label")
          .eq("user_id", session.user.id)
          .single();

        if (tenantError || !tenantRow) {
          console.error("[TenantDocuments] tenant error:", tenantError);
          if (!cancelled) {
            setState({
              status: "unauth",
              message:
                "We couldn't find a tenant record for this user. Please sign in again.",
            });
          }
          return;
        }

        // 3) Load docs for this tenant
        const { data: docsData, error: docsError } = await supabase
          .from("tenant_documents")
          .select("id, file_name, category, storage_path, uploaded_at")
          .eq("tenant_id", tenantRow.id)
          .order("uploaded_at", { ascending: false });

        if (docsError) {
          console.error("[TenantDocuments] docs fetch error:", docsError);
          throw docsError;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            tenant: tenantRow,
            docs: docsData ?? [],
          });
        }
      } catch (err: any) {
        console.error("[TenantDocuments] load error:", err);
        if (!cancelled) {
          setError(
            "We couldn't load your documents. Please refresh the page and try again."
          );
          setState({ status: "unauth" });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Convenience: reload docs after upload
  const reloadDocs = async (tenantId: string) => {
    const { data: docsData, error: docsError } = await supabase
      .from("tenant_documents")
      .select("id, file_name, category, storage_path, uploaded_at")
      .eq("tenant_id", tenantId)
      .order("uploaded_at", { ascending: false });

    if (docsError) {
      console.error("[TenantDocuments] reload error:", docsError);
      setError("Could not refresh document list.");
      return;
    }

    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, docs: docsData ?? [] }
        : prev
    );
  };

  // ---------- Upload handler ----------
  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.status !== "ready") return;

    const tenant = state.tenant;
    const form = e.currentTarget;

    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const labelInput = form.elements.namedItem("label") as HTMLInputElement;
    const categorySelect = form.elements.namedItem(
      "category"
    ) as HTMLSelectElement;

    const file = fileInput.files?.[0];
    const label = labelInput.value.trim();
    const category = categorySelect.value || "Document";

    if (!file) {
      alert("Please choose a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Build a path like: <tenant_id>/<timestamp>-<filename>
      const safeName = file.name.replace(/\s+/g, "-");
      const path = `${tenant.id}/${Date.now()}-${safeName}`;

      // 1) Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("tenant-documents") // change bucket name if needed
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[TenantDocuments] storage upload error:", uploadError);
        throw uploadError;
      }

      // 2) Insert metadata row
      const { error: insertError } = await supabase
        .from("tenant_documents") // change table name if needed
        .insert({
          tenant_id: tenant.id,
          file_name: label || file.name,
          category,
          storage_path: path,
        });

      if (insertError) {
        console.error("[TenantDocuments] insert error:", insertError);
        throw insertError;
      }

      // Clear form and refresh docs
      form.reset();
      await reloadDocs(tenant.id);
    } catch (err: any) {
      console.error("[TenantDocuments] upload error:", err);
      setError(
        "We couldn't upload your document. Please check the file and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  // ---------- Render states ----------

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
          Back to login
        </Link>
        {error && (
          <p className="text-xs text-rose-400 max-w-md text-center">{error}</p>
        )}
      </main>
    );
  }

  const { tenant, docs } = state;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
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

          <Link
            href="/"
            className="text-xs text-indigo-400 hover:underline"
          >
            ← Back to Home
          </Link>
        </header>

        {error && (
          <div className="rounded-md border border-rose-700 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)] gap-6">
          {/* LEFT: list of docs */}
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
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium">{doc.file_name}</div>
                        <div className="text-neutral-500">
                          {doc.category || "Document"}
                          {doc.uploaded_at
                            ? ` · uploaded ${new Date(
                                doc.uploaded_at
                              ).toLocaleDateString()}`
                            : null}
                        </div>
                      </div>
                      <a
                        href={toPublicUrl(doc.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                      >
                        View / Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* RIGHT: upload form */}
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
                  name="label"
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
                  <option value="Income verification">
                    Income verification
                  </option>
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
                After upload, your landlord and housing authority may view this
                document as part of managing your tenancy.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
