import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmUnitsPage } from "@/components/pm/PmUnitsPage";

export const Route = createFileRoute("/agency/manage/$propertyId/units")({
  head: () => ({ meta: [{ title: "Units — Agency — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmUnitsPage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
