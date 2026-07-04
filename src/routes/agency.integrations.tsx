import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalIntegrationsPage } from "@/components/dashboard/portal/PortalIntegrationsPage";

export const Route = createFileRoute("/agency/integrations")({
  head: () => ({ meta: [{ title: "API — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalIntegrationsPage portal="agency" />
    </AgencyShell>
  ),
});
