// app/tenants/new/page.tsx

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type PageProps = {};

// ---------- Server action: create a new tenant ----------
async function createTenant(formData: FormData) {
  "use server";

  const supabase = await createServerClient();

  // Get the logged-in owner (landlord) user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[createTenant] No authenticated user found", userError);
    // You could redirect to login if you want:
    // redirect("/login");
    return;
  }

  // Pull form values
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const unitLabel = String(formData.get("unit_label") || "").trim();

  if (!fullName || !email || !unitLabel) {
    console.error("[createTenant] Missing required fields");
    return;
  }

  // Insert tenant row and link it to the owner via owner_id
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      full_name: fullName,
      email,
      unit_label: unitLabel,
      owner_id: user.id, // 👈 IMPORTANT: ties tenant to the current owner
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createTenant] Supabase insert error:", error);
    return;
  }

  // Go straight to the ledger page for this tenant
  redirect(`/tenants/${data.id}`);
}

// ---------- Page component (form UI) ----------
export default function NewTenantPage(_props: PageProps) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">
          Add a new tenant
        </h1>

        <form action={createTenant} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs text-neutral-400">
              Full name
            </label>
            <input
              name="full_name"
              type="text"
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-neutral-400">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-neutral-400">
              Unit / Home label
            </label>
            <input
              name="unit_label"
              type="text"
              placeholder="Example: 5115"
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Create tenant
          </button>
        </form>
      </div>
    </main>
  );
}
