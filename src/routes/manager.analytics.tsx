import { createFileRoute } from "@tanstack/react-router";
import { ManagerShell } from "@/components/ManagerShell";
import { PortalAnalyticsPage } from "@/components/dashboard/portal/PortalAnalyticsPage";

export const Route = createFileRoute("/manager/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Property manager — NyumbaSearch" }] }),
  component: () => (
    <ManagerShell>
      <PortalAnalyticsPage portal="manager" />
    </ManagerShell>
  ),
});
