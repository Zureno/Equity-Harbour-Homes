"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteTenantButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName?: string; // 👈 make this optional
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const label = tenantName ? `"${tenantName}"` : "this tenant";

    const ok = window.confirm(
      `Delete tenant ${label} and all related data? This cannot be undone.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/owner/delete-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Failed to delete tenant");
        return;
      }

      // Refresh server component so the card disappears
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Something went wrong deleting tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="ml-3 rounded border border-red-500/50 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
