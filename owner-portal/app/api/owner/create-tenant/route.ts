// owner-portal/app/api/owner/create-tenant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, unitLabel } = body || {};

    if (!fullName || !email || !unitLabel) {
      return NextResponse.json(
        { error: "fullName, email and unitLabel are required" },
        { status: 400 }
      );
    }

    // 1) Create Supabase auth user for tenant
    //    We generate a random password; in real life you might send
    //    them a password-reset / magic-link instead.
    const randomPassword =
      Math.random().toString(36).slice(-10) +
      Math.random().toString(36).slice(-10);

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          role: "tenant",
          full_name: fullName,
          unit_label: unitLabel,
        },
      });

    if (userError || !userResult?.user) {
      console.error("[create-tenant] createUser error:", userError);
      return NextResponse.json(
        { error: "Failed to create tenant login user" },
        { status: 500 }
      );
    }

    const userId = userResult.user.id;

    // 2) Insert row into tenants table
    const { error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        id: userId, // IMPORTANT: matches auth user id
        full_name: fullName,
        email,
        unit_label: unitLabel,
      });

    if (tenantError) {
      console.error("[create-tenant] insert tenants error:", tenantError);
      return NextResponse.json(
        { error: "Failed to insert tenant record" },
        { status: 500 }
      );
    }

    // 3) Return the new tenant id so UI can redirect
    return NextResponse.json({ tenantId: userId }, { status: 201 });
  } catch (err: any) {
    console.error("[create-tenant] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error creating tenant" },
      { status: 500 }
    );
  }
}
