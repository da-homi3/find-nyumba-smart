import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmComplaintsPage } from "@/components/pm/PmComplaintsPage";

export const Route = createFileRoute("/agency/manage/$propertyId/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmComplaintsPage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
