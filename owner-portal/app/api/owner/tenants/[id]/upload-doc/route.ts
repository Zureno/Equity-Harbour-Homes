// owner-portal/app/api/owner/tenants/[tenantId]/upload-doc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs"; // we want Node, not edge, for file handling

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = params.id;
    const body = await req.json().catch(() => ({} as any));
    const docType: string | undefined = body.docType;
    const fileName: string | undefined = body.fileName;
    const storagePath: string | undefined = body.storagePath;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string | null) ?? "lease";

    if (!tenantId) {
        return NextResponse.json(
            { error: "Missing tenantId in URL."},
            { status: 400 }
        );
    }

    if (!file) {
      return NextResponse.json(
        { error: "Missing file" },
        { status: 400 }
      );
    }

    // Build a unique path in the bucket
    const path = `tenant/${tenantId}/${Date.now()}-${file.name}`;

    // 1) Upload to storage bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from("tenant-docs")
      .upload(path, file);

    if (uploadError) {
      console.error("[upload-doc] storage error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // 2) Insert metadata row
    const { error: insertError } = await supabaseAdmin
      .from("tenant_documents")
      .insert({
        tenant_id: tenantId,
        file_name: file.name,
        file_path: path,
        category,
      });

    if (insertError) {
      console.error("[upload-doc] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload-doc] POST error:", err);
    return NextResponse.json(
      { error: "Unexpected error processing upload-doc." },
      { status: 500 }
    );
  }
}
