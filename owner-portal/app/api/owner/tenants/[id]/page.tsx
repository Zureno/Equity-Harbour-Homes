import { DocumentsSection } from "./DocumentsSection";

// ...

export default async function TenantPage({ params }: { params: { id: string } }) {
  const tenantId = params.id;
  // you already load tenant details here…

  return (
    <main className="...">
      {/* existing tenant UI */}
      {/* … */}

      <DocumentsSection tenantId={tenantId} />
    </main>
  );
}
