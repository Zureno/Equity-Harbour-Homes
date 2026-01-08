// owner-portal/app/api/owner/tenants/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$?";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, email, unit_label } = body as {
      full_name?: string;
      email?: string;
      unit_label?: string | null;
    };

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "full_name and email are required" },
        { status: 400 }
      );
    }

    // 1) create auth user
    const tempPassword = generateTempPassword(12);

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          unit_label,
          role: "tenant",
        },
      });

    if (authError || !authData?.user) {
      console.error("[createTenant] auth error", authError);
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 500 }
      );
    }

    const authUserId = authData.user.id;

    // 2) create row in tenants and LINK it via user_id
    const { data: tenantRow, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        full_name,
        email,
        unit_label,
        user_id: authUserId,   // 🔴 THIS is the important part
        // DO NOT set "id" here – let the table's default UUID handle it
      })
      .select()
      .single();

    if (tenantError) {
      console.error("[createTenant] tenant insert error", tenantError);
      return NextResponse.json(
        { error: "User created, but failed to save tenant record" },
        { status: 500 }
      );
    }

    // 3) return temp password so you can give it to the tenant
    return NextResponse.json({
      ok: true,
      tenant: tenantRow,
      tempPassword,
    });
  } catch (err) {
    console.error("[createTenant] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error creating tenant" },
      { status: 500 }
    );
  }
}
