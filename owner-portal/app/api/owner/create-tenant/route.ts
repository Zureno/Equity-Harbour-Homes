// owner-portal/app/api/owner/create-tenant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function generateTempPassword(length = 12): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@$?";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, unitLabel, startingBalance } = await req.json();

    if (!fullName || !email || !unitLabel) {
      return NextResponse.json(
        { error: "fullName, email and unitLabel are required" },
        { status: 400 }
      );
    }

    const tempPassword = generateTempPassword();

    // 1) Create Supabase Auth user for the tenant
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role: "tenant",
        },
      });

    if (userError || !userData?.user) {
      console.error("Failed to create auth user for tenant:", userError);
      return NextResponse.json(
        { error: "Failed to create tenant login" },
        { status: 500 }
      );
    }

    const user = userData.user;

    // 2) Insert tenant row linked to that auth user
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        full_name: fullName,
        email,
        unit_label: unitLabel,
        user_id: user.id, // FK to auth.users.id
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      console.error("Supabase insert tenant error:", tenantError);

      // rollback auth user if tenant row fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      } catch (e) {
        console.error("Failed to rollback auth user:", e);
      }

      return NextResponse.json(
        { error: "Failed to create tenant record" },
        { status: 500 }
      );
    }

    // (Optional) startingBalance logic (create initial charge/payment) can go here

    // 3) Return tenantId + tempPassword to the UI
    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      tempPassword,
    });
  } catch (err) {
    console.error("Unexpected error in /api/owner/create-tenant:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
