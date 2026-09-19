import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalAnalyticsPage } from "@/components/dashboard/portal/PortalAnalyticsPage";

export const Route = createFileRoute("/agent/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalAnalyticsPage portal="agent" />
    </AgentShell>
  ),
});
