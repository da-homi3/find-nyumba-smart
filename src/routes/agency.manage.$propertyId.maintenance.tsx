import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmMaintenancePage } from "@/components/pm/PmMaintenancePage";

export const Route = createFileRoute("/agency/manage/$propertyId/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmMaintenancePage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
