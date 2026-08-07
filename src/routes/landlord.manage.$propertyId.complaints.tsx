import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmComplaintsPage } from "@/components/pm/PmComplaintsPage";

export const Route = createFileRoute("/landlord/manage/$propertyId/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmComplaintsPage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
