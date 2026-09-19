import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalImportPage } from "@/components/dashboard/portal/PortalImportPage";

export const Route = createFileRoute("/agent/import")({
  head: () => ({ meta: [{ title: "Bulk import — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalImportPage portal="agent" />
    </AgentShell>
  ),
});
