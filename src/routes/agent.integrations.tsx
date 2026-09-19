import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalIntegrationsPage } from "@/components/dashboard/portal/PortalIntegrationsPage";

export const Route = createFileRoute("/agent/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalIntegrationsPage portal="agent" />
    </AgentShell>
  ),
});
