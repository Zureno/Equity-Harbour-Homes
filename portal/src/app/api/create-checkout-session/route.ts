import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { tenantId, email, amountCents } = await req.json();

    if (!tenantId || !amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: "Missing tenantId or invalid amountCents." },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Rent payment" },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: { tenant_id: tenantId },
      success_url: `${origin}/?tab=Payments&paymentStatus=success`,
      cancel_url: `${origin}/?tab=Payments&paymentStatus=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[create-checkout-session] error:", e);
    return NextResponse.json(
      { error: e.message || "Server error" },
      { status: 500 }
    );
  }
}
