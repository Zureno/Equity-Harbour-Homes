// owner-portal/app/tenants/[id]/page.tsx
import AddChargeForm from "@/components/owner/AddChargeForm";
import AddPaymentForm from "@/components/owner/AddPaymentForm";
import DeleteTenantButton from "@/components/owner/DeleteTenantButton";
import { DocumentsSection } from "./DocumentsSection";

// If you already had other imports (for loading tenant data, etc.)
// re-add them here, but DO NOT add any supabase.from("charges").insert.

type PageProps = {
  params: { id: string };
};

export default async function TenantPage({ params }: PageProps) {
  const tenantId = params.id;

  // If you load tenant data, you can still do that here with supabase,
  // but ONLY selects, no inserts into "charges".
  //
  // const supabase = ...createServerComponentClient...
  // const { data: tenant } = await supabase.from("tenants").select("*").eq("id", tenantId).single();

  return (
    <main className="max-w-4xl mx-auto py-8 space-y-6">
      {/* Header / tenant summary */}
      <section className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenant details</h1>
        <DeleteTenantButton tenantId={tenantId} />
      </section>

      {/* Charges & payments */}
      <section className="grid gap-4 md:grid-cols-2">
        <AddChargeForm tenantId={tenantId} />
        <AddPaymentForm tenantId={tenantId} />
      </section>

      {/* Documents */}
      <DocumentsSection tenantId={tenantId} />
    </main>
  );
}
