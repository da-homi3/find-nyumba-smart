import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalPlanPage } from "@/components/dashboard/portal/PortalPlanPage";

export const Route = createFileRoute("/agent/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalPlanPage portal="agent" />
    </AgentShell>
  ),
});
