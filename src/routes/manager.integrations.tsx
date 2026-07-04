import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalIntegrationsPage } from "@/components/dashboard/portal/PortalIntegrationsPage";

export const Route = createFileRoute("/manager/integrations")({
  head: () => ({ meta: [{ title: "API — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalIntegrationsPage portal="manager" />
    </ManagerShell>
  ),
});
