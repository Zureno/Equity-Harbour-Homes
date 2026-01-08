'use client';

import { useState } from 'react';

type Props = {
  chargeId: string;
  tenantId: string;
};

export function PayWithCardButton({ chargeId, tenantId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId, tenantId }),
      });

      if (!res.ok) {
        console.error('[PayWithCardButton] error', await res.json());
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Stripe Checkout
      } else {
        console.error('[PayWithCardButton] no url returned');
        setLoading(false);
      }
    } catch (e) {
      console.error('[PayWithCardButton] exception', e);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {loading ? 'Redirecting…' : 'Pay with card'}
    </button>
  );
}
