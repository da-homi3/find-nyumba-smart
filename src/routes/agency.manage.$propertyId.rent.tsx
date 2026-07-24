import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PmRentPage } from "@/components/pm/PmRentPage";

export const Route = createFileRoute("/agency/manage/$propertyId/rent")({
  head: () => ({ meta: [{ title: "Rent — Agency — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <AgencyShell>
      <PmRentPage portal="agency" propertyId={propertyId} />
    </AgencyShell>
  );
}
