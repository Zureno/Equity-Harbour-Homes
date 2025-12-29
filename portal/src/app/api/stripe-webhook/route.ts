// app/api/stripe-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; 

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing stripe-signature header", {
      status: 400,
    });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const tenantId = session.metadata?.tenant_id || null;
    const chargeId = session.metadata?.charge_id || null;
    const note = session.metadata?.note || null;
    const reference = session.metadata?.reference || null;
    const amountTotal = session.amount_total; // in cents

    if (!tenantId || !amountTotal) {
      console.warn(
        "checkout.session.completed without tenantId or amount_total",
        session.id
      );
    } else {
      // 1) Insert payment record
      const { error: insertError } = await supabaseAdmin
        .from("payments")
        .insert({
          tenant_id: tenantId,
          amount: amountTotal / 100,
          method: "Online (card) – Stripe",
          status: "paid",
          note,
          external_id: session.id,
          reference,
          charge_id: chargeId || null, // ok if you skipped this column
        });

      if (insertError) {
        console.error("Error inserting payment into Supabase `payments`:", insertError);
      }

      // 2) Mark the corresponding charge as paid
      if (chargeId) {
        const { error: chargeError } = await supabaseAdmin
          .from("charges")
          .update({ is_paid: true })
          .eq("id", chargeId);

        if (chargeError) {
          console.error("Error marking charge as paid:", chargeError);
        }
      }
    }
  } else {
    console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
