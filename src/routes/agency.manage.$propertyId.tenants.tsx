import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmTenantsPage } from "@/components/pm/PmTenantsPage";

export const Route = createFileRoute("/agency/manage/$propertyId/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Agency — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmTenantsPage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
