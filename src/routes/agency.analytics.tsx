import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalAnalyticsPage } from "@/components/dashboard/portal/PortalAnalyticsPage";

export const Route = createFileRoute("/agency/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalAnalyticsPage portal="agency" />
    </AgencyShell>
  ),
});
