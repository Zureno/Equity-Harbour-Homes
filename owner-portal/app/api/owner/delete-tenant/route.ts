// owner-portal/app/api/owner/delete-tenant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isOwnerAuthenticated } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Require owner login
  if (!isOwnerAuthenticated(req)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { tenantId } = await req.json();

  if (!tenantId) {
    return NextResponse.json(
      { error: "Missing tenantId" },
      { status: 400 }
    );
  }

  try {
    // Delete related records first (add more tables as you start using them)
    const tablesWithTenantId = [
      "charges",
      "payments",
      "section8_cases",
      "tenant_docs",
      "tenant_documents",
      "tenant_onboarding",
      "leases",
      "maintenance_requests",
    ];

    for (const table of tablesWithTenantId) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq("tenant_id", tenantId);

      if (error) {
        console.error(`Failed deleting from ${table}`, error);
        return NextResponse.json(
          { error: `Failed removing tenant data (${table})` },
          { status: 500 }
        );
      }
    }

    // Finally delete the tenant row itself
    const { error: tenantError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenantId);

    if (tenantError) {
      console.error("Failed deleting tenant", tenantError);
      return NextResponse.json(
        { error: "Failed deleting tenant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected error deleting tenant", err);
    return NextResponse.json(
      { error: "Unexpected error deleting tenant" },
      { status: 500 }
    );
  }
}
