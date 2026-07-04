import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalImportPage } from "@/components/dashboard/portal/PortalImportPage";

export const Route = createFileRoute("/agency/import")({
  head: () => ({ meta: [{ title: "Bulk import — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalImportPage portal="agency" />
    </AgencyShell>
  ),
});
