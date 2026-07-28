import { createFileRoute } from "@tanstack/react-router";
import { AgencyShell } from "@/components/AgencyShell";
import { PortalPayoutSettingsPage } from "@/components/dashboard/portal/PortalPayoutSettingsPage";

export const Route = createFileRoute("/agency/dashboard/payouts")({
  head: () => ({ meta: [{ title: "Rent payouts — Agency — NyumbaSearch" }] }),
  component: () => (
    <AgencyShell>
      <PortalPayoutSettingsPage />
    </AgencyShell>
  ),
});
