import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, email, amountCents } = body;

  const origin = new URL(req.headers.get("origin") || "http://localhost:3000");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Rent payment",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenant_id: tenantId,
    },
    success_url: `${origin}/?tab=payments&paymentStatus=success`,
    cancel_url: `${origin}/?tab=payments&paymentStatus=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
