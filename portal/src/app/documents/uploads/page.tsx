import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/* ---------- Server action: handle upload ---------- */

async function uploadTenantDocument(formData: FormData) {
  "use server";

  const supabase = await createServerClient();

  // 1) Get logged-in user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[uploadTenantDocument] auth error:", authError);
    redirect("/login");
  }

  // 2) Look up tenant for this user
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, full_name")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (tenantError || !tenant) {
    console.error(
      "[uploadTenantDocument] Could not find tenant for user",
      { userId: user!.id, tenantError },
    );
    return;
  }

  // 3) Read form fields
  const file = formData.get("file") as File | null;
  const label = (formData.get("label") as string | null) ?? "";
  const category = (formData.get("category") as string | null) ?? "Document";

  if (!file || file.size === 0) {
    console.error("[uploadTenantDocument] No file provided");
    return;
  }

  // 4) Build a storage path like: <tenant_id>/<timestamp>-<filename>
  const safeName = file.name.replace(/\s+/g, "-");
  const path = `${tenant.id}/${Date.now()}-${safeName}`;

  // 5) Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("tenant-documents") // <- change if your bucket name is different
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadTenantDocument] Storage upload error:", uploadError);
    return;
  }

  // 6) Insert metadata row into tenant_documents
  const { error: insertError } = await supabase
    .from("tenant_documents") // <- change if your table name is different
    .insert({
      tenant_id: tenant.id,
      file_name: label || file.name,
      category,
      storage_path: path,
    });

  if (insertError) {
    console.error("[uploadTenantDocument] DB insert error:", insertError);
    // Optional: delete the uploaded file if DB insert fails
    return;
  }

  // 7) Refresh documents list + go back to /documents
  revalidatePath("/documents");
  redirect("/documents");
}

/* ---------- Page component ---------- */

export default async function TenantUploadPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, full_name, unit_label")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Lease &amp; Documents
          </p>
          <h1 className="text-2xl font-semibold">Upload a document</h1>
          {tenant && (
            <p className="text-xs text-neutral-400">
              {tenant.full_name} – Unit {tenant.unit_label}
            </p>
          )}
        </header>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="text-sm font-medium mb-3">Add a new document</h2>

          <form action={uploadTenantDocument} className="space-y-4">
            {/* File */}
            <div className="space-y-1">
              <label className="text-xs text-neutral-400">
                File <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                name="file"
                required
                className="block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm
                           file:mr-3 file:rounded-md file:border-0 file:bg-indigo-500 file:px-3 file:py-1.5
                           file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-400"
              />
            </div>

            {/* Display name */}
            <div className="space-y-1">
              <label className="text-xs text-neutral-400">Display name</label>
              <input
                type="text"
                name="label"
                placeholder="Example: Signed lease 2025"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs text-neutral-400">Category</label>
              <select
                name="category"
                defaultValue="Document"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Lease">Lease</option>
                <option value="Income verification">Income verification</option>
                <option value="ID">ID</option>
                <option value="Inspection">Inspection</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Upload document
            </button>

            <p className="text-[11px] text-neutral-500">
              After upload, your landlord and housing authority may view this
              document as part of managing your tenancy.
            </p>
          </form>
        </section>

        <p className="text-xs text-neutral-500">
          When the upload finishes, you&apos;ll be redirected back to the{" "}
          <a href="/documents" className="text-indigo-400 hover:underline">
            Documents
          </a>{" "}
          page where you can view or download your file.
        </p>
      </div>
    </main>
  );
}
