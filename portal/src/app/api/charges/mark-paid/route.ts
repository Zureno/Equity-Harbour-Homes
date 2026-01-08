// portal/src/app/api/charges/mark-paid/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// IMPORTANT: use the *service role* key so you can update charges
// and bypass RLS safely from the server.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body.chargeId !== "string") {
      return NextResponse.json(
        { error: "chargeId is required" },
        { status: 400 }
      );
    }

    const chargeId = body.chargeId;

    const { error } = await supabaseAdmin
      .from("charges")
      .update({
        is_paid: true,
        // optional: also set a timestamp if you have this column
        // paid_at: new Date().toISOString(),
      })
      .eq("id", chargeId);

    if (error) {
      console.error("[mark-paid] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to update charge" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mark-paid] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
