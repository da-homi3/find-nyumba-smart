import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalAnalyticsPage } from "@/components/dashboard/portal/PortalAnalyticsPage";

export const Route = createFileRoute("/landlord/analytics")({
  head: () => ({ meta: [{ title: "Analytics — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalAnalyticsPage portal="landlord" />
    </LandlordShell>
  ),
});
