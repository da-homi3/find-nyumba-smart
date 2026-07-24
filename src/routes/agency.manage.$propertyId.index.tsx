import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmPropertyDashboardPage } from "@/components/pm/PmPropertyDashboardPage";

export const Route = createFileRoute("/agency/manage/$propertyId/")({
  head: () => ({ meta: [{ title: "Property dashboard — Agency — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmPropertyDashboardPage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
