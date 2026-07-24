import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmTenantsPage } from "@/components/pm/PmTenantsPage";

export const Route = createFileRoute("/landlord/manage/$propertyId/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmTenantsPage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
