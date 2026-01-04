// owner-portal/app/tenants/[id]/DocumentsSection.tsx
"use client";

import React, { useState } from "react";

type Props = {
  tenantId: string;
};

export function DocumentsSection({ tenantId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const categoryInput = form.elements.namedItem(
      "category"
    ) as HTMLSelectElement;

    const file = fileInput.files?.[0];
    if (!file) {
      setError("Please pick a file.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", categoryInput.value);

    try {
      const res = await fetch(
        `/api/owner/tenants/${tenantId}/upload-doc`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }

      setSuccess("Document uploaded successfully.");
      form.reset();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <h2 className="text-sm font-semibold">Lease & Documents</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            className="text-xs text-neutral-200"
            disabled={uploading}
          />
          <select
            name="category"
            className="rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs"
            defaultValue="lease"
            disabled={uploading}
          >
            <option value="lease">Lease</option>
            <option value="inspection">Inspection</option>
            <option value="notice">Notice</option>
            <option value="other">Other</option>
          </select>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-emerald-400">{success}</p>}
        <p className="text-[11px] text-neutral-500">
          Upload signed leases, inspection reports, or other tenant documents.
        </p>
      </form>
    </div>
  );
}
