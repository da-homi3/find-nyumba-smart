import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmMaintenancePage } from "@/components/pm/PmMaintenancePage";

export const Route = createFileRoute("/landlord/manage/$propertyId/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmMaintenancePage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
