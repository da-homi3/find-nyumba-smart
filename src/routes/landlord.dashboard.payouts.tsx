import { createFileRoute } from "@tanstack/react-router";
import { LandlordShell } from "@/components/LandlordShell";
import { PortalPayoutSettingsPage } from "@/components/dashboard/portal/PortalPayoutSettingsPage";

export const Route = createFileRoute("/landlord/dashboard/payouts")({
  head: () => ({ meta: [{ title: "Rent payouts — NyumbaSearch" }] }),
  component: () => (
    <LandlordShell>
      <PortalPayoutSettingsPage />
    </LandlordShell>
  ),
});
