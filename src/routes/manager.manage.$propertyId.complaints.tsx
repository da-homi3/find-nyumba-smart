import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmComplaintsPage } from "@/components/pm/PmComplaintsPage";

export const Route = createFileRoute("/manager/manage/$propertyId/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Manage — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmComplaintsPage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
