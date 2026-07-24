import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PmRentPage } from "@/components/pm/PmRentPage";

export const Route = createFileRoute("/landlord/manage/$propertyId/rent")({
  head: () => ({ meta: [{ title: "Rent — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <LandlordShell>
      <PmRentPage portal="landlord" propertyId={propertyId} />
    </LandlordShell>
  );
}
