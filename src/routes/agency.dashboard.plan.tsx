import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalPlanPage } from "@/components/dashboard/portal/PortalPlanPage";

export const Route = createFileRoute("/agency/dashboard/plan")({
  head: () => ({ meta: [{ title: "Plan — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalPlanPage portal="agency" />
    </AgencyShell>
  ),
});
