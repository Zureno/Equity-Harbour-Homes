// app/api/stripe-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // needs service role so it can write
);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[stripe-webhook] signature error", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("[stripe-webhook] Received event", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const tenantId = session.metadata?.tenant_id;
    const amountCents = session.amount_total ?? 0;
    const amount = amountCents / 100;

    if (!tenantId || amount <= 0) {
      console.error(
        "[stripe-webhook] Missing tenantId or amount on session",
        session.id
      );
      return NextResponse.json({ received: true });
    }

    // 1) Insert payment row
    const { error: payErr } = await supabase.from("payments").insert({
      tenant_id: tenantId,
      amount,
      method: "Online card (Stripe)",
      note: `Stripe session ${session.id}`,
    });

    if (payErr) {
      console.error("[stripe-webhook] payments insert error", payErr);
    }

    // 2) (Optional) mark all open charges as paid for now
    const { error: chargeErr } = await supabase
      .from("charges")
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("is_paid", false);

    if (chargeErr) {
      console.error("[stripe-webhook] charges update error", chargeErr);
    }
  }

  // Ignore other event types for now
  return NextResponse.json({ received: true });
}
