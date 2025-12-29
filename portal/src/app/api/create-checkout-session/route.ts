// app/api/create-checkout-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const stripe = new Stripe(stripeSecretKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chargeId, tenantId, email, note, reference } = body || {};

    if (!chargeId || !tenantId) {
      return NextResponse.json(
        { error: "Missing chargeId or tenantId" },
        { status: 400 }
      );
    }

    // Look up the charge row
    const { data: charge, error: chargeError } = await supabaseAdmin
      .from("charges")
      .select("id, tenant_id, amount, description, is_paid")
      .eq("id", chargeId)
      .eq("tenant_id", tenantId)
      .single();

    if (chargeError || !charge) {
      console.error("Charge lookup error:", chargeError);
      return NextResponse.json(
        { error: "Charge not found for this tenant" },
        { status: 404 }
      );
    }

    if (charge.is_paid) {
      return NextResponse.json(
        { error: "Charge is already marked as paid" },
        { status: 400 }
      );
    }

    const amountDollars = Number(charge.amount);
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      return NextResponse.json(
        { error: "Invalid charge amount" },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amountDollars * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Rent payment",
              description: charge.description || "Tenant rent payment",
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/?tab=payments&paymentStatus=success`,
      cancel_url: `${siteUrl}/?tab=payments&paymentStatus=cancelled`,
      metadata: {
        tenant_id: charge.tenant_id,
        charge_id: charge.id,     // 🔴 this is important
        note: note || "",
        reference: reference || "",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
