import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmPropertyDashboardPage } from "@/components/pm/PmPropertyDashboardPage";

export const Route = createFileRoute("/landlord/manage/$propertyId/")({
  head: () => ({ meta: [{ title: "Property dashboard — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmPropertyDashboardPage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
