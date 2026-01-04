import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // <-- or your actual admin client path

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{}> }   // 👈 match Next's expected type
) {
  try {
    // params is a Promise; await and cast so we can read `id`
    const { id } = (await params) as { id: string };
    const tenantId = id;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Missing tenantId in URL." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({} as any));

    const docType: string | undefined = body.docType;
    const fileName: string | undefined = body.fileName;
    const storagePath: string | undefined = body.storagePath;

    if (!docType || !fileName || !storagePath) {
      return NextResponse.json(
        { error: "Missing docType, fileName or storagePath in body." },
        { status: 400 }
      );
    }

    // Insert into tenant_docs
    const { error } = await supabaseAdmin
      .from("tenant_docs")
      .insert({
        tenant_id: tenantId,
        doc_type: docType,
        file_name: fileName,
        storage_path: storagePath,
      });

    if (error) {
      console.error("[upload-doc] DB insert error", error);
      return NextResponse.json(
        { error: "Could not save document info." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[upload-doc] POST error", err);
    return NextResponse.json(
      { error: "Unexpected error processing upload-doc." },
      { status: 500 }
    );
  }
}
