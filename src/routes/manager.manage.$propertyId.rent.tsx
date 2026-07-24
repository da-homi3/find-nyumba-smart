import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmRentPage } from "@/components/pm/PmRentPage";

export const Route = createFileRoute("/manager/manage/$propertyId/rent")({
  head: () => ({ meta: [{ title: "Rent — Manager — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmRentPage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
