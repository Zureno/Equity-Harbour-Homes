// owner-portal/app/tenants/new/page.tsx
import CreateTenantForm from "@/components/owner/CreateTenantForm";

export default function NewTenantPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Add tenant</h1>
        <CreateTenantForm />
      </div>
    </main>
  );
}
