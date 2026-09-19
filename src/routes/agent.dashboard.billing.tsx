import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalBillingPage } from "@/components/dashboard/portal/PortalBillingPage";

export const Route = createFileRoute("/agent/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalBillingPage portal="agent" />
    </AgentShell>
  ),
});
