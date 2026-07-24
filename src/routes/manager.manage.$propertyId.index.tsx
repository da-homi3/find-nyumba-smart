import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmPropertyDashboardPage } from "@/components/pm/PmPropertyDashboardPage";

export const Route = createFileRoute("/manager/manage/$propertyId/")({
  head: () => ({ meta: [{ title: "Property dashboard — Manager — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmPropertyDashboardPage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
