import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmUnitsPage } from "@/components/pm/PmUnitsPage";

export const Route = createFileRoute("/manager/manage/$propertyId/units")({
  head: () => ({ meta: [{ title: "Units — Manager — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmUnitsPage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
