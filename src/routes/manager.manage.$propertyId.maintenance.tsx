import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmMaintenancePage } from "@/components/pm/PmMaintenancePage";

export const Route = createFileRoute("/manager/manage/$propertyId/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmMaintenancePage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
