import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalIntegrationsPage } from "@/components/dashboard/portal/PortalIntegrationsPage";

export const Route = createFileRoute("/developer/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalIntegrationsPage portal="property_developer" />
    </DeveloperShell>
  ),
});
