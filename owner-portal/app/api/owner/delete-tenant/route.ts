import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, authUserId } = await req.json() as {
      tenantId: string;
      authUserId?: string | null;
    };

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // 1) Delete onboarding steps for this tenant (so FK is satisfied)
    const { error: stepsError } = await supabaseAdmin
      .from("onboarding_steps")
      .delete()
      .eq("tenant_id", tenantId);

    if (stepsError) {
      console.error("[deleteTenant] onboarding_steps delete error", stepsError);
      return NextResponse.json(
        { error: "Failed to delete onboarding steps" },
        { status: 500 }
      );
    }

    // 2) Delete tenant row
    const { error: tenantError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenantId);

    if (tenantError) {
      console.error("[deleteTenant] tenant delete error", tenantError);
      return NextResponse.json(
        { error: "Failed to delete tenant" },
        { status: 500 }
      );
    }

    // 3) (Optional) delete Supabase auth user as well
    if (authUserId) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
        authUserId
      );
      if (authError) {
        console.warn(
          "[deleteTenant] tenant row deleted but failed to delete auth user",
          authError
        );
        // Don't fail the whole request – just log it
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[deleteTenant] unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error deleting tenant" },
      { status: 500 }
    );
  }
}
