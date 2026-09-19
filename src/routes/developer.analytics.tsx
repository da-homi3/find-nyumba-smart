import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/DeveloperShell";
import { PortalAnalyticsPage } from "@/components/dashboard/portal/PortalAnalyticsPage";

export const Route = createFileRoute("/developer/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Developer — NyumbaSearch" }] }),
  component: () => (
    <DeveloperShell>
      <PortalAnalyticsPage portal="property_developer" />
    </DeveloperShell>
  ),
});
