// owner-portal/app/tenants/[id]/charges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next 16 expects params as a Promise here
    const { id: tenantId } = await params;

    const { amount, description, due_date } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("charges")
      .insert({
        tenant_id: tenantId,
        amount,
        description,
        due_date,
      })
      .select()
      .single();

    if (error) {
      console.error("[charges.route] Supabase error:", error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error("[charges.route] Crash:", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
