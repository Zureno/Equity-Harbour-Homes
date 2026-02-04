"use client";

import { useState } from "react";

type Props = {
  tenantId: string;          // business tenant id (public.tenants.id)
  email: string;             // tenant email (optional but helpful)
  amountCents: number;       // how much to pay (in cents)
};

export function PayWithCardButton({ tenantId, email, amountCents }: Props) {
  const [loading, setLoading] = useState(false);
  const disabled = loading || !tenantId || !amountCents || amountCents <= 0;

  const handleClick = async () => {
    if (disabled) return;

    setLoading(true);

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          email,
          amountCents,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.error("[PayWithCardButton] error", body);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      console.error("[PayWithCardButton] no url returned", data);
      setLoading(false);
    } catch (e) {
      console.error("[PayWithCardButton] exception", e);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {loading ? "Redirecting…" : "Pay with card"}
    </button>
  );
}
