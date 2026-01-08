// src/app/api/owner/add-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AddPaymentBody = {
  tenantId: string;
  amount: number;
  method?: string;
  note?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const { tenantId, amount, method, note } =
      (await req.json()) as AddPaymentBody;

    if (!tenantId || amount == null) {
      return NextResponse.json(
        { error: "Missing tenantId or amount" },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    // 1) Insert payment row (service-role, bypasses RLS)
    const { error: payError } = await supabaseAdmin.from("payments").insert({
      tenant_id: tenantId,
      amount: parsedAmount,
      method: method || "manual",
      note: note || null,
      status: "paid",
    });

    if (payError) {
      console.error("[add-payment] insert error:", payError);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    // 2) Apply payment to oldest unpaid charges (also via service-role)
    let remaining = parsedAmount;

    const { data: charges, error: chargesError } = await supabaseAdmin
      .from("charges")
      .select("id, amount, is_paid, due_date")
      .eq("tenant_id", tenantId)
      .eq("is_paid", false)
      .order("due_date", { ascending: true });

    if (chargesError) {
      console.error("[add-payment] fetch charges error:", chargesError);
      // Payment is saved; we just couldn't apply it to charges.
      return NextResponse.json(
        {
          ok: true,
          warning: "Payment saved, but could not apply to charges.",
        },
        { status: 200 }
      );
    }

    for (const c of charges || []) {
      if (remaining <= 0) break;

      const chargeAmount = Number(c.amount ?? 0);
      if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) continue;

      if (remaining >= chargeAmount) {
        const { error: updateErr } = await supabaseAdmin
          .from("charges")
          .update({ is_paid: true })
          .eq("id", c.id);

        if (updateErr) {
          console.error("[add-payment] update charge error:", updateErr);
          continue;
        }

        remaining -= chargeAmount;
      } else {
        // Partial leftover – leave remaining as unapplied for now.
        break;
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[add-payment] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
