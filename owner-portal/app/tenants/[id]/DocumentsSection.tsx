// owner-portal/app/tenants/[id]/DocumentsSection.tsx
"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  tenantId: string;
};

export function DocumentsSection({ tenantId }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Lease");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    try {
      setIsUploading(true);

      // 1) Upload to Storage
      const path = `tenant/${tenantId}/${Date.now()}-${file.name}`;

      const { error: storageError } = await supabase.storage
        .from("tenant-docs")
        .upload(path, file);

      if (storageError) throw storageError;

      // 2) Insert metadata row
      const { error: dbError } = await supabase
        .from("tenant_documents")
        .insert({
          tenant_id: tenantId,
          file_path: path,
          file_name: file.name,
          category,
        });

      if (dbError) throw dbError;

      setSuccess("Document uploaded successfully.");
      setFile(null);
    } catch (err: any) {
      console.error("[DocumentsSection] upload error:", err);
      setError(err.message ?? "Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="text-sm font-semibold mb-3">Lease &amp; Documents</h2>

      <form onSubmit={handleUpload} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">
            Document file
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-neutral-200"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full rounded-md bg-neutral-950 border border-neutral-700 px-2 py-1 text-xs"
          >
            <option>Lease</option>
            <option>Inspection</option>
            <option>Notice</option>
            <option>Other</option>
          </select>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-700/40 rounded-md px-2 py-1">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/40 rounded-md px-2 py-1">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
        >
          {isUploading ? "Uploading…" : "Upload document"}
        </button>
      </form>
    </div>
  );
}
