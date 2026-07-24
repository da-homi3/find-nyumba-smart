import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmUnitsPage } from "@/components/pm/PmUnitsPage";

export const Route = createFileRoute("/landlord/manage/$propertyId/units")({
  head: () => ({ meta: [{ title: "Units — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmUnitsPage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
