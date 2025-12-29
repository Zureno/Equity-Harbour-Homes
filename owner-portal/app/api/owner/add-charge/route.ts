// src/app/api/owner/add-charge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; 

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, amount, description, dueDate } = await req.json();

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

    const { error } = await supabaseAdmin.from("charges").insert({
      tenant_id: tenantId,
      amount: parsedAmount,
      description: description || null,
      due_date: dueDate || null,
      is_paid: false,
    });

    if (error) {
      console.error("[add-charge] insert error:", error);
      return NextResponse.json(
        { error: "Failed to create charge" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[add-charge] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
