import { createFileRoute } from "@tanstack/react-router";
import { AgentShell } from "@/components/AgentShell";
import { PortalCaretakersPage } from "@/components/dashboard/portal/PortalCaretakersPage";

export const Route = createFileRoute("/agent/caretakers")({
  head: () => ({ meta: [{ title: "Caretakers — Agent — NyumbaSearch" }] }),
  component: () => (
    <AgentShell>
      <PortalCaretakersPage portal="agent" />
    </AgentShell>
  ),
});
