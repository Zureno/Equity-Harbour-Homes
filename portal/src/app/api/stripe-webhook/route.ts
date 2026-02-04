import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[stripe-webhook] signature error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.log("[stripe-webhook] event:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const tenantId = session.metadata?.tenant_id;
    const amountCents = session.amount_total ?? 0;
    const amount = amountCents / 100;

    console.log("[stripe-webhook] completed:", {
      sessionId: session.id,
      tenantId,
      amount,
    });

    if (!tenantId || amount <= 0) {
      console.error("[stripe-webhook] Missing tenantId or amount", session.id);
      return NextResponse.json({ received: true });
    }

    const { error: payErr } = await supabase.from("payments").insert({
      tenant_id: tenantId,
      amount,
      source: "stripe",
      method: "Online card (Stripe)",
      note: `Stripe session ${session.id}`,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent?.toString() ?? null,
    });

    if (payErr) console.error("[stripe-webhook] payments insert error", payErr);
  }

  return NextResponse.json({ received: true });
}
