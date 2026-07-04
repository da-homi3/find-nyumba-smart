import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalIntegrationsPage } from "@/components/dashboard/portal/PortalIntegrationsPage";

export const Route = createFileRoute("/landlord/integrations")({
  head: () => ({ meta: [{ title: "API & integrations — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalIntegrationsPage portal="landlord" />
    </LandlordShell>
  ),
});
