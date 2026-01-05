// owner-portal/src/app/documents/DocumentsPageClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type TenantDocType = "upload_voucher" | "upload_id_docs" | "sign_lease";

const DOC_OPTIONS: { value: TenantDocType; label: string }[] = [
  { value: "upload_voucher", label: "Section 8 voucher / approval" },
  { value: "upload_id_docs", label: "ID & required documents" },
  { value: "sign_lease", label: "Signed lease" },
];

const DOC_LABELS: Record<string, string> = {
  upload_voucher: "Section 8 voucher / approval",
  upload_id_docs: "ID & required documents",
  sign_lease: "Signed lease",
};

type TenantDoc = {
  id: string;
  tenant_id: string;
  doc_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  created_at: string | null;
};

const DocumentsPageClient: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantIdFromUrl = searchParams.get("tenantId");
  const tenantNameFromUrl = searchParams.get("tenantName");

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLabel, setTenantLabel] = useState<string>("");
  const [docs, setDocs] = useState<TenantDoc[]>([]);
  const [docType, setDocType] = useState<TenantDocType>("upload_voucher");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------------------------------
  // Load tenant + docs
  // --------------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      setError(null);
      setLoading(true);

      try {
        let effectiveTenantId = tenantIdFromUrl;

        // If we didn't get tenantId in the URL, try to find tenant by email
        if (!effectiveTenantId) {
          const { data: userRes, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userRes?.user) {
            setError("You must be signed in to view this page.");
            return;
          }

          const userEmail = userRes.user.email;
          const { data: t2, error: tErr } = await supabase
            .from("tenants")
            .select("id, name, unit, email")
            .eq("email", userEmail)
            .maybeSingle();

          if (tErr || !t2) {
            console.warn("[Documents] tenant lookup via email failed", tErr);
            setError("Could not load your tenant profile.");
            return;
          }

          effectiveTenantId = t2.id;
          setTenantLabel(
            `${t2.name ?? ""}${t2.unit ? ` • Unit ${t2.unit}` : ""}`
          );
        } else if (tenantNameFromUrl) {
          // when coming from owner portal with tenantName in URL
          setTenantLabel(tenantNameFromUrl);
        } else {
          setTenantLabel(`Unit ${effectiveTenantId.slice(0, 8)}…`);
        }

        setTenantId(effectiveTenantId);

        // Load existing docs
        const { data: docsData, error: docsErr } = await supabase
          .from("tenant_docs")
          .select("*")
          .eq("tenant_id", effectiveTenantId)
          .order("created_at", { ascending: false });

        if (docsErr) {
          console.warn("[Documents] load docs error", docsErr);
          setError("Could not load your documents.");
          return;
        }

        setDocs((docsData || []) as TenantDoc[]);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantIdFromUrl, tenantNameFromUrl]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenantId) {
      setError("Missing tenant id. Please open this page from the tenant portal.");
      return;
    }

    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxBytes = 10 * 1024 * 1024; // 10 MB

    if (!allowedTypes.includes(file.type) || file.size > maxBytes) {
      setError("Please upload a PDF or image (PDF / JPG / PNG) under 10 MB.");
      return;
    }

    setUploading(true);

    try {
      // Safe random path
      const randomId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? (crypto as Crypto).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const ext = file.name.includes(".")
        ? file.name.substring(file.name.lastIndexOf(".") + 1)
        : "";
      const safeExt = ext ? `.${ext}` : "";

      const path = `${tenantId}/${docType}/${randomId}${safeExt}`;

      // 1) upload to storage
      const { error: storageErr } = await supabase.storage
        .from("tenant-docs")
        .upload(path, file, { upsert: true });

      if (storageErr) {
        console.warn("[Documents] storage upload error", storageErr);
        setError("We couldn't upload that file. Please try again in a moment.");
        return;
      }

      // 2) insert metadata into tenant_docs
      const { data: insertedDoc, error: insertErr } = await supabase
        .from("tenant_docs")
        .insert({
          tenant_id: tenantId,
          doc_type: docType,
          file_name: file.name,
          storage_path: path,
        })
        .select()
        .single();

      if (insertErr) {
        console.warn("[Documents] tenant_docs insert error", insertErr);
        setError("File stored, but we couldn't save document info.");
        return;
      }

      setDocs((prev) => [insertedDoc as TenantDoc, ...prev]);
      setFile(null);

      const el = document.getElementById("file-input") as HTMLInputElement | null;
      if (el) el.value = "";
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDoc = async (doc: TenantDoc) => {
    if (!doc.storage_path) return;

    const { data, error } = await supabase.storage
      .from("tenant-docs")
      .createSignedUrl(doc.storage_path, 600); // 10 minutes

    if (error || !data?.signedUrl) {
      alert("Could not open file yet. Please try again.");
      return;
    }

    window.location.href = data.signedUrl;
  };

  const handleBack = () => {
    router.push("/"); // back to tenant portal home
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-neutral-50">
      <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-semibold">Lease &amp; Documents</h1>
          <p className="text-xs text-neutral-400">
            Upload and view your approval letter, ID docs, signed lease and other
            documents.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-400">
          {tenantLabel && <span>{tenantLabel}</span>}
          <button
            onClick={handleBack}
            className="px-3 py-1 rounded-full border border-neutral-700 hover:bg-neutral-900"
          >
            Back to portal
          </button>
        </div>
      </header>

      <main className="px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Upload card */}
        <section className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Upload a document</h2>

          {error && (
            <div className="mb-3 text-[11px] text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <form
            onSubmit={handleUpload}
            className="flex flex-col md:flex-row md:items-center gap-4 text-xs"
          >
            <div className="flex-1 space-y-1">
              <label className="block text-neutral-300">Document type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as TenantDocType)}
                className="w-full md:w-72 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-50"
              >
                {DOC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-1">
              <label className="block text-neutral-300">File</label>
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="block w-full text-xs text-neutral-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-indigo-500 file:text-white file:text-xs hover:file:bg-indigo-400"
              />
              <div className="text-[11px] text-neutral-500">
                PDF, JPG or PNG, up to 10 MB.
              </div>
            </div>

            <div className="pt-4 md:pt-6">
              <button
                type="submit"
                disabled={uploading || loading}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-xs font-semibold disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </section>

        {/* Documents list */}
        <section className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-3">Your documents</h2>

          {loading ? (
            <p className="text-[11px] text-neutral-400">Loading documents…</p>
          ) : docs.length === 0 ? (
            <p className="text-[11px] text-neutral-400">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="divide-y divide-neutral-800 text-xs">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <div className="font-medium text-neutral-100">
                      {DOC_LABELS[doc.doc_type ?? ""] ??
                        doc.doc_type ??
                        "Document"}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {doc.file_name}
                      {doc.created_at && (
                        <>
                          {" • "}
                          {new Date(doc.created_at).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                  {doc.storage_path && (
                    <button
                      className="text-[11px] px-3 py-1 rounded-full border border-neutral-600 hover:bg-neutral-800"
                      onClick={() => handleOpenDoc(doc)}
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DocumentsPageClient;
