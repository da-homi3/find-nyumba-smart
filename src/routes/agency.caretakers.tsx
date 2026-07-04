import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalCaretakersPage } from "@/components/dashboard/portal/PortalCaretakersPage";

export const Route = createFileRoute("/agency/caretakers")({
  head: () => ({ meta: [{ title: "Caretakers — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalCaretakersPage portal="agency" />
    </AgencyShell>
  ),
});
