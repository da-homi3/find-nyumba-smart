import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PmTenantsPage } from "@/components/pm/PmTenantsPage";

export const Route = createFileRoute("/manager/manage/$propertyId/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Manager — NyumbaSearch" }] }),
  component: Page,
});

function Page() {
  const { propertyId } = Route.useParams();
  return (
    <ManagerShell>
      <PmTenantsPage portal="manager" propertyId={propertyId} />
    </ManagerShell>
  );
}
